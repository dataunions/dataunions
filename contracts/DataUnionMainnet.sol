pragma solidity ^0.6.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Ownable.sol";
import "./PurchaseListener.sol";
import "./CloneLib.sol";

interface IAMB {
    function messageSender() external view returns (address);

    function maxGasPerTx() external view returns (uint256);

    function transactionHash() external view returns (bytes32);

    function messageId() external view returns (bytes32);

    function messageSourceChainId() external view returns (bytes32);

    function messageCallStatus(bytes32 _messageId) external view returns (bool);

    function failedMessageDataHash(bytes32 _messageId)
        external
        view
        returns (bytes32);

    function failedMessageReceiver(bytes32 _messageId)
        external
        view
        returns (address);

    function failedMessageSender(bytes32 _messageId)
        external
        view
        returns (address);

    function requireToPassMessage(
        address _contract,
        bytes calldata _data,
        uint256 _gas
    ) external returns (bytes32);
}

interface ITokenMediator {
    function erc677token() external view returns (address);
    function bridgeContract() external view returns (address);
    function relayTokens(address _from, address _receiver, uint256 _value) external;
}

contract DataUnionMainnet is Ownable, PurchaseListener {
    using SafeMath for uint256;

    IAMB public amb;
    ITokenMediator public token_mediator;
    address public sidechain_DU_factory;
    uint256 public sidechain_maxgas;
    uint256 public token_sent_to_bridge;
    ERC20 public token;
    // needed to compute sidechain address
    address public sidechain_template_DU;

    constructor() public Ownable(address(0)) {}

    function initialize(
        address _token_mediator,
        address _sidechain_DU_factory,
        uint256 _sidechain_maxgas,
        address _sidechain_template_DU,
        address _owner,
        uint256 adminFeeFraction,
        address[] memory agents
    )  public {
        require(!isInitialized(), "init_once");
        token_mediator = ITokenMediator(_token_mediator);
        amb = IAMB(token_mediator.bridgeContract());
        token = ERC20(token_mediator.erc677token());
        sidechain_DU_factory = _sidechain_DU_factory;
        sidechain_maxgas = _sidechain_maxgas;
        sidechain_template_DU = _sidechain_template_DU;
        owner = _owner;
        deployNewDUSidechain(adminFeeFraction, agents);
    }

    function isInitialized() public view returns (bool) {
        return address(token) != address(0);
    }

    
    function deployNewDUSidechain(uint256 adminFeeFraction, address[] memory agents) public {
        bytes memory data = abi.encodeWithSignature("deployNewDUSidechain(address,uint256,address[])", owner, adminFeeFraction, agents);
        amb.requireToPassMessage(sidechain_DU_factory, data, sidechain_maxgas);
    }

    function sidechainAddress()
        public view
        returns (address proxy)
    {
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

    function onPurchase(
        bytes32 productId,
        address subscriber,
        uint256 endTimestamp,
        uint256 priceDatacoin,
        uint256 feeDatacoin
    ) external override returns (bool accepted) {
        sendTokensToBridge();
        return true;
    }

    function sendTokensToBridge() public returns (uint256) {
        uint256 bal = token.balanceOf(address(this));
        if (bal == 0) return 0;
        // approve 0 first?
        require(token.approve(address(token_mediator), 0), "approve_failed");
        require(token.approve(address(token_mediator), bal), "approve_failed");

        token_mediator.relayTokens(address(this), sidechainAddress(), bal);
        require(token.balanceOf(address(this)) == 0, "transfer_failed");
        token_sent_to_bridge = token_sent_to_bridge.add(bal);
        
        bytes memory data = abi.encodeWithSignature("addRevenue()");
        amb.requireToPassMessage(sidechainAddress(), data, sidechain_maxgas);

        return bal;
    }
}
