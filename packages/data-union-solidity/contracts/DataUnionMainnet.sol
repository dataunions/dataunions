// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
 // TODO: switch to "openzeppelin-solidity/contracts/access/Ownable.sol";
import "./Ownable.sol";
import "./PurchaseListener.sol";
import "./CloneLib.sol";
import "./IAMB.sol";
import "./ITokenMediator.sol";

contract DataUnionMainnet is Ownable, PurchaseListener {

    event RevenueReceived(uint256 amount);

    event FeesChanged(uint256 adminFee, uint256 dataUnionFee);
    event FeesCharged(uint256 adminFee, uint256 dataUnionFee);

    event AdminFeesWithdrawn(address indexed admin, uint256 amount);
    event DataUnionBeneficiaryChanged(address current, address old);
    event DataUnionFeesWithdrawn(address indexed admin, uint256 amount);

    ITokenMediator public tokenMediator;
    address public sidechainDUFactory;
    uint256 public sidechainMaxGas;
    ERC20 public token;

    // NOTE: any variables set below will NOT be visible in clones from CloneLib / factories
    //       clones must set variables in initialize()

    address public sidechainDUTemplate; // needed to compute sidechain address

    bool public autoSendFees;

    uint256 public adminFeeFraction;
    uint256 public totalAdminFees;
    uint256 public totalAdminFeesWithdrawn;

    uint256 public dataUnionFeeFraction;
    uint256 public totalDataUnionFees;
    uint256 public totalDataUnionFeesWithdrawn;
    address public dataUnionBeneficiary;

    function version() public pure returns (uint256) { return 2; }

    uint256 public tokensSentToBridge;

    constructor() Ownable(address(0)) {}

    function initialize(
        address _token,
        address _mediator,
        address _sidechainDUFactory,
        uint256 _sidechainMaxGas,
        address _sidechainDUTemplate,
        address _owner,
        uint256 _adminFeeFraction,
        uint256 _dataUnionFeeFraction,
        address _dataUnionBeneficiary,
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
        setFees(_adminFeeFraction, _dataUnionFeeFraction);
        setDataUnionBeneficiary(_dataUnionBeneficiary);
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
     * Admin and DU fees as a fraction of revenue,
     *   using fixed-point decimal in the same way as ether: 50% === 0.5 ether === "500000000000000000"
     * @param newAdminFee fee that goes to the DU owner
     * @param newDataUnionFee fee that goes to the DU beneficiary
     */
    function setFees(uint256 newAdminFee, uint256 newDataUnionFee) public onlyOwner {
        require((newAdminFee + newDataUnionFee) <= 1 ether, "error_Fees");
        adminFeeFraction = newAdminFee;
        dataUnionFeeFraction = newDataUnionFee;
        emit FeesChanged(adminFeeFraction, dataUnionFeeFraction);
    }

    function setDataUnionBeneficiary(address _dataUnionBeneficiary) public onlyOwner {
        require(_dataUnionBeneficiary != address(0), "invalid_address");
        dataUnionBeneficiary = _dataUnionBeneficiary;
        emit DataUnionBeneficiaryChanged(dataUnionBeneficiary, _dataUnionBeneficiary);
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
     * ERC677 callback function, see https://github.com/ethereum/EIPs/issues/677
     * Sends the tokens arriving through a transferAndCall to the sidechain (ignore arguments/calldata)
     * Only the token contract is authorized to call this function
     */
    function onTokenTransfer(address, uint256, bytes calldata) external returns (bool success) {
        if (msg.sender != address(token)) { return false; }
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

    function dataUnionFeesWithdrawable() public view returns (uint256) {
        return totalDataUnionFees - totalDataUnionFeesWithdrawn;
    }

    function unaccountedTokens() public view returns (uint256) {
        return token.balanceOf(address(this)) - (adminFeesWithdrawable() + dataUnionFeesWithdrawable());
    }

    function sendTokensToBridge() public returns (uint256) {
        uint256 newTokens = unaccountedTokens();
        if (newTokens == 0) return 0;

        emit RevenueReceived(newTokens);

        uint256 adminFee = (newTokens * adminFeeFraction) / (10 ** token.decimals());
        uint256 duFee = (newTokens * dataUnionFeeFraction) / (10 ** token.decimals());
        uint256 memberEarnings = newTokens - (adminFee + duFee);

        totalAdminFees += adminFee;
        totalDataUnionFees += duFee;
        emit FeesCharged(adminFee, duFee);
        if (autoSendFees) {
            withdrawAdminFees();
            withdrawDataUnionFees();
        }

        // transfer memberEarnings
        require(token.approve(address(tokenMediator), memberEarnings), "approve_failed");

        // must send some non-zero data to trigger the callback function
        tokenMediator.relayTokensAndCall(address(token), sidechainAddress(), memberEarnings, abi.encodePacked("DU2"));

        // check that memberEarnings were sent
        require(unaccountedTokens() == 0, "not_transferred");
        tokensSentToBridge += memberEarnings;

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

    function withdrawDataUnionFees() public returns (uint256) {
        uint256 withdrawable = dataUnionFeesWithdrawable();
        if (withdrawable == 0) return 0;
        totalDataUnionFeesWithdrawn += withdrawable;
        require(token.transfer(dataUnionBeneficiary, withdrawable), "transfer_failed");
        emit DataUnionFeesWithdrawn(dataUnionBeneficiary, withdrawable);
        return withdrawable;
    }

}
