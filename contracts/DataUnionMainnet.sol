pragma solidity 0.6.6;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Ownable.sol"; // TODO: switch to "openzeppelin-solidity/contracts/access/Ownable.sol";
import "./PurchaseListener.sol";
import "./CloneLib.sol";
import "./IAMB.sol";
import "./ITokenMediator.sol";
import "./IMainnetMigrationManager.sol";

contract DataUnionMainnet is Ownable, PurchaseListener {
    using SafeMath for uint256;

    event AdminFeeChanged(uint256 adminFee);
    event AdminFeeCharged(uint256 amount);
    event AdminFeesWithdrawn(address indexed admin, uint256 amount);
    event MigrateToken(address indexed newToken, address indexed oldToken);
    event MigrateMediator(address indexed newMediator, address indexed oldMediator);
    event RevenueReceived(uint256 amount);

    IAMB public amb;
    ITokenMediator public token_mediator;
    address public sidechain_DU_factory;
    uint256 public sidechain_maxgas;
    ERC20 public token;
    IMainnetMigrationManager public migrationManager;

/*
    NOTE: any variables set below will NOT be visible in clones
    clones must set variables in initialize()
*/

    // needed to compute sidechain address
    address public sidechain_template_DU;
    uint256 public adminFeeFraction;
    uint256 public totalAdminFees;
    uint256 public totalAdminFeesWithdrawn;
    bool public autoSendAdminFee;

    function version() public pure returns (uint256) { return 2; }

    uint256 public tokensSentToBridge;


    constructor() public Ownable(address(0)) {}

    function initialize(
        address _migrationManager,
        address _sidechain_DU_factory,
        uint256 _sidechain_maxgas,
        address _sidechain_template_DU,
        address _owner,
        uint256 _adminFeeFraction,
        address[] memory agents
    )  public {
        require(!isInitialized(), "init_once");
        // must set default values here so that there are in clone state
        autoSendAdminFee = true;
        migrationManager = IMainnetMigrationManager(_migrationManager);

        //during setup, msg.sender is admin
        owner = msg.sender;

        token_mediator = ITokenMediator(migrationManager.newMediator());
        amb = IAMB(token_mediator.bridgeContract());
        token = ERC20(migrationManager.newToken());
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

    function sidechainAddress() public view returns (address) {
        return CloneLib.predictCloneAddressCreate2(sidechain_template_DU, sidechain_DU_factory, bytes32(uint256(address(this))));
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
    function onPurchase(bytes32, address, uint256, uint256, uint256) external override returns (bool) {
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
        bytes4 bridgeMode = token_mediator.getBridgeMode();
        //MultiAMB 0xb1516c26 == bytes4(keccak256(abi.encodePacked("multi-erc-to-erc-amb")))
        //Single token AMB 0x76595b56 ==  bytes4(keccak256(abi.encodePacked("erc-to-erc-amb")))
        if(bridgeMode == 0xb1516c26) {
            token_mediator.relayTokens(address(token), sidechainAddress(), memberEarnings);
        }
        else if(bridgeMode == 0x76595b56){
            token_mediator.relayTokens(sidechainAddress(), memberEarnings);
        }
        else{
            revert("unknown_bridge_mode");
        }

        //check that memberEarnings were sent
        require(unaccountedTokens() == 0, "not_transferred");
        tokensSentToBridge = tokensSentToBridge.add(memberEarnings);

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

    function migrate() public onlyOwner {
        address newToken = migrationManager.newToken();
        if(newToken != address(0) && newToken != address(token)) {
            emit MigrateToken(newToken, address(token));
            token = ERC20(newToken);
        }
        address newMediator = migrationManager.newMediator();
        if(newMediator != address(0) && newMediator != address(token_mediator)) {
            emit MigrateMediator(newMediator, address(token_mediator));
            token_mediator = ITokenMediator(newMediator);
        }
    }
}
