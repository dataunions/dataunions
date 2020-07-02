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

interface ITokenMediator {
    function erc677token() external view returns (address);
    function bridgeContract() external view returns (address);
    function relayTokens(address _from, address _receiver, uint256 _value) external;
}

contract DataUnionMainnet is Ownable {
    using SafeMath for uint256;

    IAMB public amb;
    ITokenMediator public token_mediator;
    address public sidechain_DU_factory;
    uint256 public sidechain_maxgas;
    uint256 public token_sent_to_bridge;
    ERC20 public token;
    // needed to compute sidechain address
    address public sidechain_template_DU;

    constructor(
        address _token_mediator,
        address _sidechain_DU_factory,
        uint256 _sidechain_maxgas,
        address _sidechain_template_DU,
        uint256 adminFeeFraction,
        address[] memory agents
    )  public Ownable(msg.sender) {
        token_mediator = ITokenMediator(_token_mediator);
        amb = IAMB(token_mediator.bridgeContract());
        token = ERC20(token_mediator.erc677token());
        sidechain_DU_factory = _sidechain_DU_factory;
        sidechain_maxgas = _sidechain_maxgas;
        sidechain_template_DU = _sidechain_template_DU;
        deployNewDUSidechain(adminFeeFraction, agents);
    }

    function deployNewDUSidechain(uint256 adminFeeFraction, address[] memory agents) public {
        bytes memory data = abi.encodeWithSignature("deployNewDUSidechain(address,uint256,address[])", owner, adminFeeFraction, agents);
        amb.requireToPassMessage(sidechain_DU_factory, data, sidechain_maxgas);
    }

    function sidechainAddress()
        public view
        returns (address proxy)
    {
        // Adapted from https://github.com/optionality/clone-factory/blob/32782f82dfc5a00d103a7e61a17a5dedbd1e8e9d/contracts/CloneFactory.sol
        bytes20 targetBytes = bytes20(sidechain_template_DU);
        bytes32 codehash;
        assembly {
            let clone := mload(0x40)
            mstore(
                clone,
                0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000
            )
            mstore(add(clone, 0x14), targetBytes)
            mstore(
                add(clone, 0x28),
                0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000
            )
            codehash := keccak256(clone, 0x37)
        }
        // address(this) will always be used by sidechain factory as salt for CREATE2
        return address(uint160(uint256(keccak256(abi.encodePacked(byte(0xff),address(sidechain_DU_factory),bytes32(uint256(address(this))),codehash)))));
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

        token_mediator.relayTokens(address(this), sidechainAddress(), bal);
        require(token.balanceOf(address(this)) == 0, "transfer_failed");
        token_sent_to_bridge = token_sent_to_bridge.add(bal);
        
        bytes memory data = abi.encodeWithSignature("addRevenue()");
        amb.requireToPassMessage(sidechainAddress(), data, sidechain_maxgas);

        return bal;
    }
}
