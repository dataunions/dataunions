pragma solidity ^0.6.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Ownable.sol";
import "./PurchaseListener.sol";

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

interface ERC677Receiver {
    function onTokenTransfer(
        address _from,
        uint256 _value,
        bytes calldata _data
    ) external returns (bool);
    function relayTokens(address _from, address _receiver, uint256 _value) external;

}


contract DataUnionMainnet is Ownable {
    using SafeMath for uint256;

    IAMB public amb;
    ERC677Receiver public token_mediator;
    address public sidechain_DU;
    uint256 public sidechain_maxgas;
    uint256 public token_sent_to_bridge;
    ERC20 public token;

    constructor() public Ownable(msg.sender) {}

    function isInitialized() public view returns (bool) {
        return address(amb) != address(0);
    }

    function initialize(
        address _amb,
        address _sidechain_DU,
        address _token,
        address _token_mediator,
        uint256 _sidechain_maxgas
    ) public onlyOwner {
        require(!isInitialized(),"init_once");
        amb = IAMB(_amb);
        sidechain_DU = _sidechain_DU;
        sidechain_maxgas = _sidechain_maxgas;
        token = ERC20(_token);
        token_mediator = ERC677Receiver(_token_mediator);
    }


    //calls withdraw(member) on home network
    function withdraw(address member) public {
        require(isInitialized(), "not_initialized");
        bytes memory data = abi.encodeWithSignature(
            "withdraw(address,bool)",
            member,
            true
        );
        amb.requireToPassMessage(sidechain_DU, data, sidechain_maxgas);
    }

    function onPurchase(
        bytes32 productId,
        address subscriber,
        uint256 endTimestamp,
        uint256 priceDatacoin,
        uint256 feeDatacoin
    ) external returns (bool accepted) {
        sendTokensToBridge();
        return true;
    }

    function sendTokensToBridge() public returns (uint256) {
        uint256 bal = token.balanceOf(address(this));
        if (bal == 0) return 0;
        // approve 0 first?
        require(token.approve(address(token_mediator), 0), "approve_failed");
        require(token.approve(address(token_mediator), bal), "approve_failed");

        token_mediator.relayTokens(address(this), sidechain_DU, bal);
        require(token.balanceOf(address(this)) == 0, "transfer_failed");
        token_sent_to_bridge = token_sent_to_bridge.add(bal);
        
        bytes memory data = abi.encodeWithSignature("addRevenue()");
        amb.requireToPassMessage(sidechain_DU, data, sidechain_maxgas);

        return bal;
    }
}
