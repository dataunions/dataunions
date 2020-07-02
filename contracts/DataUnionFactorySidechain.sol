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
}

contract DataUnionFactory {
    event DUCreated(address indexed);
    address public data_union_sidechain_template;
    IAMB public amb;
    ITokenMediator public token_mediator;
    mapping(address => address) public mainchain2sidechain;

    constructor(address _amb, address _data_union_sidechain_template, address _token_mediator) public {
        data_union_sidechain_template = _data_union_sidechain_template;
        amb = IAMB(_amb);
        token_mediator = ITokenMediator(_token_mediator);
    }

    //https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-sdk/master/packages/lib/contracts/upgradeability/ProxyFactory.sol
    function deployMinimal(address _logic, bytes memory _data)
        public
        returns (address proxy)
    {
        // Adapted from https://github.com/optionality/clone-factory/blob/32782f82dfc5a00d103a7e61a17a5dedbd1e8e9d/contracts/CloneFactory.sol
        bytes20 targetBytes = bytes20(_logic);
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
            proxy := create(0, clone, 0x37)
        }
        if (_data.length > 0) {
            (bool success, ) = proxy.call(_data);
            require(success);
        }
    }

    function relayMessageToSidechainDU(bytes memory data)
        public
        returns (bool, bytes memory)
    {
        require(msg.sender == address(amb), "only_amb");
        address sender = amb.messageSender();
        address recipient = mainchain2sidechain[sender];
        require(recipient != address(0), "du_not_found");
        return recipient.call(data);
    }
/*
function initialize(
        address token_address,
        uint256 adminFeeFraction_,
        address[] memory agents,
        address _token_mediator,
        address _mainchain_DU
    )
*/
    function deployNewDUSidechain(uint256 adminFeeFraction, address[] memory agents) public returns (address) {
        require(msg.sender == address(amb), "only_amb");
        address du_mainnet = amb.messageSender();
        bytes memory data = abi.encodeWithSignature("initialize(address,uint256,address[],address,address)",
            token_mediator.erc677token(),
            adminFeeFraction,
            agents,
            address(token_mediator),
            du_mainnet
        );
        address du = deployMinimal(data_union_sidechain_template, data);
        mainchain2sidechain[du_mainnet] = du;
        emit DUCreated(du);
        return du;
    }
}
