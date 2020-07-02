pragma solidity ^0.6.0;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Ownable.sol";

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


contract DataUnionFactorySidechain {
    event DUCreated(address indexed mainnet, address indexed sidenet);
    event ContractDeployed(address indexed sidenet);
    event DeployRequest(address indexed template, bytes32 indexed salt);

    address public data_union_sidechain_template;
    IAMB public amb;
    ITokenMediator public token_mediator;

    constructor( address _token_mediator, address _data_union_sidechain_template) public {
        token_mediator = ITokenMediator(_token_mediator);
        data_union_sidechain_template = _data_union_sidechain_template;
        amb = IAMB(token_mediator.bridgeContract());
    }

    //https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-sdk/master/packages/lib/contracts/upgradeability/ProxyFactory.sol
    function deployMinimal(address template, bytes memory _data, bytes32 salt)
        internal
        returns (address proxy)
    {
        emit DeployRequest(template, salt);
        // Adapted from https://github.com/optionality/clone-factory/blob/32782f82dfc5a00d103a7e61a17a5dedbd1e8e9d/contracts/CloneFactory.sol
        bytes20 targetBytes = bytes20(template);
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
            proxy := create2(0, clone, 0x37, salt)
        }
        
        if (_data.length > 0) {
            (bool success, ) = proxy.call(_data);
            require(success);
        }
        
        emit ContractDeployed(proxy);
    }

    function sidechainAddress(address mainet_address)
        public view
        returns (address proxy)
    {
        return predictAddressCreate2(data_union_sidechain_template, bytes32(bytes20(mainet_address)));
    }

    function predictAddressCreate2(address template, bytes32 salt)
        public view
        returns (address proxy)
    {
        // Adapted from https://github.com/optionality/clone-factory/blob/32782f82dfc5a00d103a7e61a17a5dedbd1e8e9d/contracts/CloneFactory.sol
        bytes20 targetBytes = bytes20(template);
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
        return address(uint160(uint256(keccak256(abi.encodePacked(byte(0xff),address(this),salt,codehash)))));
    }

    function relayMessageToSidechainDU(bytes memory data)
        public
        returns (bool, bytes memory)
    {
        //if the request didnt come from AMB, use the sender's address as the corresponding "mainnet" address
        address sender = msg.sender == address(amb) ? amb.messageSender() : msg.sender;
        address recipient = sidechainAddress(sender);
        require(recipient != address(0), "du_not_found");
        return recipient.call(data);
    }
/*
    initialize(address _owner,
        address token_address,
        uint256 adminFeeFraction_,
        address[] memory agents,
        address _token_mediator,
        address _mainchain_DU)


    users can only deploy with salt = their key.
*/
    function deployNewDUSidechain(address owner, uint256 adminFeeFraction, address[] memory agents) public returns (address) {
        //if the request didnt come from AMB, use the sender's address as the corresponding "mainnet" address
        address du_mainnet = msg.sender == address(amb) ? amb.messageSender() : msg.sender;
        bytes32 salt = bytes32(uint256(du_mainnet));
        bytes memory data = abi.encodeWithSignature("initialize(address,address,uint256,address[],address,address)",
            owner,
            token_mediator.erc677token(),
            adminFeeFraction,
            agents,
            address(token_mediator),
            du_mainnet
        );
        address du = deployMinimal(data_union_sidechain_template, data, salt);
        emit DUCreated(du_mainnet, du);
        return du;
    }
}
