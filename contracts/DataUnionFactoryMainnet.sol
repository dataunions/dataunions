pragma solidity 0.6.6;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./CloneLib.sol";
import "./IAMB.sol";
import "./ITokenMediator.sol";

interface IDataUnionMainnet {
    function sidechainAddress() external view returns (address proxy);
}


contract DataUnionFactoryMainnet {
    event MainnetDUCreated(address indexed mainnet, address indexed sidechain, address indexed owner, address template);

    address public dataUnionMainnetTemplate;

    // needed to calculate address of sidechain contract
    address public dataUnionSidechainTemplate;
    address public dataUnionSidechainFactory;
    uint256 public sidechainMaxgas;
    IAMB public amb;
    ITokenMediator public tokenMediator;
    address public token;

    constructor(address _token,
                address _tokenMediator,
                address _dataUnionMainnetTemplate,
                address _dataUnionSidechainTemplate,
                address _dataUnionSidechainFactory,
                uint256 _sidechainMaxgas)
        public
    {
        token = _token;
        tokenMediator = ITokenMediator(_tokenMediator);
        dataUnionMainnetTemplate = _dataUnionMainnetTemplate;
        dataUnionSidechainTemplate = _dataUnionSidechainTemplate;
        dataUnionSidechainFactory = _dataUnionSidechainFactory;
        amb = IAMB(tokenMediator.bridgeContract());
        sidechainMaxgas = _sidechainMaxgas;
    }


    function sidechainAddress(address mainet_address)
        public view
        returns (address)
    {
        return CloneLib.predictCloneAddressCreate2(
            dataUnionSidechainTemplate,
            dataUnionSidechainFactory,
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
            dataUnionMainnetTemplate,
            address(this),
            salt
        );
    }


/*
    function initialize(
        address _token,
        address _tokenMediator,
        address _sidechain_DU_factory,
        uint256 _sidechainMaxgas,
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
        bytes memory data = abi.encodeWithSignature("initialize(address,address,address,uint256,address,address,uint256,address[])",
            token,
            tokenMediator,
            dataUnionSidechainFactory,
            sidechainMaxgas,
            dataUnionSidechainTemplate,
            owner,
            adminFeeFraction,
            agents
        );
        address du = CloneLib.deployCodeAndInitUsingCreate2(CloneLib.cloneBytecode(dataUnionMainnetTemplate), data, salt);
        emit MainnetDUCreated(du, sidechainAddress(du), owner, dataUnionMainnetTemplate);
        return du;
    }
}
