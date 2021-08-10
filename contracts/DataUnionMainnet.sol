// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./Ownable.sol"; // TODO: switch to "openzeppelin-solidity/contracts/access/Ownable.sol";
import "./PurchaseListener.sol";
import "./CloneLib.sol";
import "./IAMB.sol";
import "./ITokenMediator.sol";

contract DataUnionMainnet is Ownable, PurchaseListener {

    event FeesChanged(uint256 adminFee, uint256 duFee);    
    event FeesCharged(uint256 adminFee, uint256 duFee);

    event AdminFeesWithdrawn(address indexed admin, uint256 amount);
    
    event RevenueReceived(uint256 amount);
    
    event DuBeneficiaryChanged(address current, address old);
    event DuFeesWithdrawn(address indexed admin, uint256 amount);

    ITokenMediator public tokenMediator;
    address public sidechainDUFactory;
    uint256 public sidechainMaxGas;
    ERC20 public token;

/*
    NOTE: any variables set below will NOT be visible in clones
    clones must set variables in initialize()
*/

    // needed to compute sidechain address
    address public sidechainDUTemplate;
    uint256 public adminFeeFraction;
    uint256 public totalAdminFees;
    uint256 public totalAdminFeesWithdrawn;
    
    bool public autoSendFees;

    //du beneficiary info
    uint256 public duFeeFraction;
    uint256 public totalDuFees;
    uint256 public totalDuFeesWithdrawn;
    address public duBeneficiary;

    function version() public pure returns (uint256) { return 2; }

    uint256 public tokensSentToBridge;


    constructor() public Ownable(address(0)) {}

    function initialize(
        address _token,
        address _mediator,
        address _sidechainDUFactory,
        uint256 _sidechainMaxGas,
        address _sidechainDUTemplate,
        address _owner,
        uint256 _adminFeeFraction,
        uint256 _duFeeFraction,
        address _duBeneficiary,
        address[] memory agents
    )  public {
        require(!isInitialized(), "init_once");
        // must set default values here so that there are in clone state
        autoSendFees = true;

        //during setup, msg.sender is admin
        owner = msg.sender;

        tokenMediator = ITokenMediator(_mediator);
        token = ERC20(_token);
        sidechainDUFactory = _sidechainDUFactory;
        sidechainMaxGas = _sidechainMaxGas;
        sidechainDUTemplate = _sidechainDUTemplate;
        setFees(_adminFeeFraction, _duFeeFraction);
        setDuBeneficiary(_duBeneficiary);
        //transfer to real admin
        owner = _owner;
        deployNewDUSidechain(agents);
    }

    function isInitialized() public view returns (bool) {
        return address(token) != address(0);
    }

    function amb() public view returns (IAMB) {
        return IAMB(tokenMediator.bridgeContract());
    }

    /**
     * Admin and du fees as a fraction of revenue.
     * @param newAdminFee fixed-point decimal in the same way as ether: 50% === 0.5 ether === "500000000000000000"
     * @param newDuFee fixed-point decimal in the same way as ether: 50% === 0.5 ether === "500000000000000000"
     */
    function setFees(uint256 newAdminFee, uint256 newDuFee) public onlyOwner {
        require((newAdminFee + newDuFee) <= 1 ether, "error_Fees");
        adminFeeFraction = newAdminFee;
        duFeeFraction = newDuFee;
        emit FeesChanged(adminFeeFraction, duFeeFraction);
    }


    function setDuBeneficiary(address _duBeneficiary) public onlyOwner {
        require(_duBeneficiary != address(0), "invalid_address");
        duBeneficiary = _duBeneficiary;        
        emit DuBeneficiaryChanged(duBeneficiary, _duBeneficiary);
    }


    function setAutoSendFees(bool autoSend) public onlyOwner {
        autoSendFees = autoSend;
    }


    function deployNewDUSidechain(address[] memory agents) public {
        bytes memory data = abi.encodeWithSignature("deployNewDUSidechain(address,address[])", owner, agents);
        amb().requireToPassMessage(sidechainDUFactory, data, sidechainMaxGas);
    }

    function sidechainAddress() public view returns (address) {
        return CloneLib.predictCloneAddressCreate2(sidechainDUTemplate, sidechainDUFactory, bytes32(uint256(uint160(address(this)))));
    }

    /**
    ERC677 callback function
    see https://github.com/ethereum/EIPs/issues/677
    */
    function onTokenTransfer(address, uint256, bytes calldata) external returns (bool success) {
        if(msg.sender != address(token)){
            return false;
        }
        sendTokensToBridge();
        return true;
    }

    //function onPurchase(bytes32 productId, address subscriber, uint256 endTimestamp, uint256 priceDatacoin, uint256 feeDatacoin)
    function onPurchase(bytes32, address, uint256, uint256, uint256) external override returns (bool) {
        sendTokensToBridge();
        return true;
    }

    function adminFeesWithdrawable() public view returns (uint256) {
        return totalAdminFees - totalAdminFeesWithdrawn;
    }


    function duFeesWithdrawable() public view returns (uint256) {
        return totalDuFees - totalDuFeesWithdrawn;
    }


    function unaccountedTokens() public view returns (uint256) {
        return token.balanceOf(address(this)) - (adminFeesWithdrawable() + duFeesWithdrawable());
    }

   

    function sendTokensToBridge() public returns (uint256) {
        uint256 newTokens = unaccountedTokens();
        if (newTokens == 0) return 0;

        emit RevenueReceived(newTokens);

        uint256 adminFee = (newTokens * adminFeeFraction) / (10 ** token.decimals());
        uint256 duFee = (newTokens * duFeeFraction) / (10 ** token.decimals());
        uint256 memberEarnings = newTokens - (adminFee + duFee);

        totalAdminFees += adminFee;
        totalDuFees += duFee;
        emit FeesCharged(adminFee, duFee);
        if(autoSendFees) {
            withdrawAdminFees();
            withdrawDuFees();
        }

        // transfer memberEarnings
        require(token.approve(address(tokenMediator), memberEarnings), "approve_failed");
        //must send some no-zero data to trigger callback fn
        tokenMediator.relayTokensAndCall(address(token), sidechainAddress(), memberEarnings, abi.encodePacked("DU2"));
        //check that memberEarnings were sent
        require(unaccountedTokens() == 0, "not_transferred");
        tokensSentToBridge = tokensSentToBridge + memberEarnings;

        return newTokens;
    }

    function withdrawAdminFees() public returns (uint256) {
        uint256 withdrawable = adminFeesWithdrawable();
        if (withdrawable == 0) return 0;
        totalAdminFeesWithdrawn += withdrawable;
        require(token.transfer(owner, withdrawable), "transfer_failed");
        emit AdminFeesWithdrawn(owner, withdrawable);
        return withdrawable;
    }

    function withdrawDuFees() public returns (uint256) {
        uint256 withdrawable = duFeesWithdrawable();
        if (withdrawable == 0) return 0;
        totalDuFeesWithdrawn += withdrawable;
        require(token.transfer(duBeneficiary, withdrawable), "transfer_failed");
        emit DuFeesWithdrawn(duBeneficiary, withdrawable);
        return withdrawable;
    }
    
}
