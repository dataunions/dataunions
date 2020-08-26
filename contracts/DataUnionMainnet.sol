pragma solidity ^0.6.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Ownable.sol"; // TODO: switch to "openzeppelin-solidity/contracts/access/Ownable.sol";
import "./PurchaseListener.sol";
import "./CloneLib.sol";
import "./IAMB.sol";

interface ITokenMediator {
    function erc677token() external view returns (address);
    function bridgeContract() external view returns (address);
    function relayTokens(address _from, address _receiver, uint256 _value) external;
}

contract DataUnionMainnet is Ownable, PurchaseListener {
    using SafeMath for uint256;

    event AdminFeeChanged(uint256 adminFee);
    event AdminFeeCharged(uint256 amount);
    event AdminFeesWithdrawn(address indexed admin, uint256 amount);

    event RevenueReceived(uint256 amount);

    IAMB public amb;
    ITokenMediator public token_mediator;
    address public sidechain_DU_factory;
    uint256 public sidechain_maxgas;
    ERC20 public token;

    // needed to compute sidechain address
    address public sidechain_template_DU;
    uint256 public adminFeeFraction;
    uint256 public totalAdminFees;
    uint256 public totalAdminFeesWithdrawn;
    bool public autoSendAdminFee = true;
 /*
    totalEarnings includes:
         member earnings (ie revenue - admin fees)
         tokens held for members via transferToMemberInContract()

    totalRevenue = totalEarnings + totalAdminFees;
*/
    uint256 public totalEarnings;


    constructor() public Ownable(address(0)) {}

    function initialize(
        address _token_mediator,
        address _sidechain_DU_factory,
        uint256 _sidechain_maxgas,
        address _sidechain_template_DU,
        address _owner,
        uint256 _adminFeeFraction,
        address[] memory agents
    )  public {
        require(!isInitialized(), "init_once");
        //during setup, msg.sender is admin
        owner = msg.sender;

        token_mediator = ITokenMediator(_token_mediator);
        amb = IAMB(token_mediator.bridgeContract());
        token = ERC20(token_mediator.erc677token());
        sidechain_DU_factory = _sidechain_DU_factory;
        sidechain_maxgas = _sidechain_maxgas;
        sidechain_template_DU = _sidechain_template_DU;
        setAdminFee(_adminFeeFraction);
        //transfer to real admin
        owner = _owner;
        deployNewDUSidechain(agents);
    }

    function isInitialized() public view returns (bool) {
        return address(token) != address(0);
    }

    /**
     * Admin fee as a fraction of revenue.
     * @param newAdminFee fixed-point decimal in the same way as ether: 50% === 0.5 ether === "500000000000000000"
     */
    function setAdminFee(uint256 newAdminFee) public onlyOwner {
        require(newAdminFee <= 1 ether, "error_adminFee");
        adminFeeFraction = newAdminFee;
        emit AdminFeeChanged(adminFeeFraction);
    }

    function setAutoSendAdminFee(bool autoSend) public onlyOwner {
        autoSendAdminFee = autoSend;
    }


    function deployNewDUSidechain(address[] memory agents) public {
        bytes memory data = abi.encodeWithSignature("deployNewDUSidechain(address,address[])", owner, agents);
        amb.requireToPassMessage(sidechain_DU_factory, data, sidechain_maxgas);
    }

    function sidechainAddress() public view returns (address proxy) {
        return CloneLib.predictCloneAddressCreate2(sidechain_template_DU, sidechain_DU_factory, bytes32(uint256(address(this))));
    }

/*
2 way doesnt work atm
    //calls withdraw(member) on home network
    function withdraw(address member) public {
        bytes memory data = abi.encodeWithSignature(
            "withdraw(address,bool)",
            member,
            true
        );
        amb.requireToPassMessage(sidechainAddress(), data, sidechain_maxgas);
    }
    */

    //function onPurchase(bytes32 productId, address subscriber, uint256 endTimestamp, uint256 priceDatacoin, uint256 feeDatacoin)
    function onPurchase(bytes32, address, uint256, uint256, uint256) external override returns (bool accepted) {
        sendTokensToBridge();
        return true;
    }

    function adminFeesWithdrawable() public view returns (uint256) {
        return totalAdminFees.sub(totalAdminFeesWithdrawn);
    }

    function unaccountedTokens() public view returns (uint256) {
        return token.balanceOf(address(this)).sub(adminFeesWithdrawable());
    }


    function sendTokensToBridge() public returns (uint256) {
        uint256 newTokens = unaccountedTokens();
        if (newTokens == 0) return 0;

        emit RevenueReceived(newTokens);

        uint256 adminFee = newTokens.mul(adminFeeFraction).div(10**18);
        uint256 memberEarnings = newTokens.sub(adminFee);

        totalAdminFees = totalAdminFees.add(adminFee);
        emit AdminFeeCharged(adminFee);
        if(autoSendAdminFee) withdrawAdminFees();

        // transfer memberEarnings
        require(token.approve(address(token_mediator), 0), "approve_failed");
        require(token.approve(address(token_mediator), memberEarnings), "approve_failed");
        token_mediator.relayTokens(address(this), sidechainAddress(), memberEarnings);
        //check that memberEarnings were sent
        require(unaccountedTokens() == 0, "not_transferred");
        totalEarnings = totalEarnings.add(memberEarnings);

        bytes memory data = abi.encodeWithSignature("addRevenue()");
        amb.requireToPassMessage(sidechainAddress(), data, sidechain_maxgas);
        return newTokens;
    }

    function withdrawAdminFees() public returns (uint256) {
        uint256 withdrawable = adminFeesWithdrawable();
        if (withdrawable == 0) return 0;
        totalAdminFeesWithdrawn = totalAdminFeesWithdrawn.add(withdrawable);
        require(token.transfer(owner, withdrawable), "transfer_failed");
        emit AdminFeesWithdrawn(owner, withdrawable);
        return withdrawable;
    }
}
