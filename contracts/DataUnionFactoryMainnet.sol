pragma solidity 0.6.6;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./CloneLib.sol";
import "./IAMB.sol";
import "./ITokenMediator.sol";
import "./FactoryConfig.sol";

interface IDataUnionMainnet {
    function sidechainAddress() external view returns (address proxy);
}

contract DataUnionFactoryMainnet {
    event MainnetDUCreated(address indexed mainnet, address indexed sidechain, address indexed owner, address template);

    address public data_union_mainnet_template;

    // needed to calculate address of sidechain contract
    address public data_union_sidechain_template;
    address public data_union_sidechain_factory;
    uint256 public sidechain_maxgas;
    FactoryConfig public migrationManager;

    constructor(address _migrationManager,
                address _data_union_mainnet_template,
                address _data_union_sidechain_template,
                address _data_union_sidechain_factory,
                uint256 _sidechain_maxgas)
        public
    {
        migrationManager = FactoryConfig(_migrationManager);
        data_union_mainnet_template = _data_union_mainnet_template;
        data_union_sidechain_template = _data_union_sidechain_template;
        data_union_sidechain_factory = _data_union_sidechain_factory;
        sidechain_maxgas = _sidechain_maxgas;
    }

    function amb() public view returns (IAMB) {
        return IAMB(ITokenMediator(migrationManager.currentMediator()).bridgeContract());
    }
 
    function token() public view returns (address) {
        return migrationManager.currentToken();
    }


    function sidechainAddress(address mainet_address)
        public view
        returns (address)
    {
        return CloneLib.predictCloneAddressCreate2(
            data_union_sidechain_template,
            data_union_sidechain_factory,
            bytes32(uint256(mainet_address))
        );
    }
    /*

    */
    function mainnetAddress(address deployer, string memory name)
        public view
        returns (address)
    {
        bytes32 salt = keccak256(abi.encode(bytes(name), deployer));
        return CloneLib.predictCloneAddressCreate2(
            data_union_mainnet_template,
            address(this),
            salt
        );
    }


/*
    function initialize(
        address _token,
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
    function deployNewDataUnion(address owner, uint256 adminFeeFraction, address[] memory agents, string memory name)
        public
        returns (address)
    {
        bytes32 salt = keccak256(abi.encode(bytes(name), msg.sender));
        bytes memory data = abi.encodeWithSignature("initialize(address,address,uint256,address,address,uint256,address[])",
            migrationManager,
            data_union_sidechain_factory,
            sidechain_maxgas,
            data_union_sidechain_template,
            owner,
            adminFeeFraction,
            agents
        );
        address du = CloneLib.deployCodeAndInitUsingCreate2(CloneLib.cloneBytecode(data_union_mainnet_template), data, salt);
        emit MainnetDUCreated(du, sidechainAddress(du), owner, data_union_mainnet_template);
        return du;
    }
}
