pragma solidity ^0.6.0;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Ownable.sol";
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

interface IDataUnionMainnet {
        function sidechainAddress() external view returns (address proxy);
}


contract DataUnionFactoryMainnet {
    event MainnetDUCreated(address indexed mainnet, address indexed sidechain, address indexed owner, address template);

    address public data_union_mainnet_template;

    //needed to calculate address of sidechain contract
    address public data_union_sidechain_template;
    address public data_union_sidechain_factory;
    uint256 public sidechain_maxgas;
    IAMB public amb;
    ITokenMediator public token_mediator;

    constructor( address _token_mediator, 
                address _data_union_mainnet_template,
                address _data_union_sidechain_template,
                address _data_union_sidechain_factory,
                uint256 _sidechain_maxgas) public {
        token_mediator = ITokenMediator(_token_mediator);
        data_union_mainnet_template = _data_union_mainnet_template;
        data_union_sidechain_template = _data_union_sidechain_template;
        data_union_sidechain_factory = _data_union_sidechain_factory;
        amb = IAMB(token_mediator.bridgeContract());
        sidechain_maxgas = _sidechain_maxgas;
    }

    function sidechainAddress(address mainet_address)
        public view
        returns (address proxy)
    {
        return CloneLib.predictCloneAddressCreate2(
            data_union_sidechain_template,
            data_union_sidechain_factory,
            bytes32(bytes20(mainet_address)));
    }

/*
    function initialize(
        address _token_mediator,
        address _sidechain_DU_factory,
        uint256 _sidechain_maxgas,
        address _sidechain_template_DU,
        address _owner,
        uint256 adminFeeFraction,
        address[] memory agents
    )  public {
    users can only deploy with salt = their key.
*/
    function deployNewDUMainnet(address owner, uint256 adminFeeFraction, address[] memory agents) public returns (address) {
        bytes memory data = abi.encodeWithSignature("initialize(address,address,uint256,address,address,uint256,address[])",
            token_mediator,
            data_union_sidechain_factory,
            sidechain_maxgas,
            data_union_sidechain_template,
            owner,
            adminFeeFraction,
            agents
        );
        address du = CloneLib.deployCodeAndInitUsingCreate(CloneLib.cloneBytecode(data_union_mainnet_template), data);
        emit MainnetDUCreated(du, sidechainAddress(du), owner, data_union_mainnet_template);
        return du;
    }
}
