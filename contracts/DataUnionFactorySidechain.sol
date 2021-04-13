pragma solidity 0.6.6;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./CloneLib.sol";
import "./IAMB.sol";
import "./ITokenMediator.sol";
import "./Ownable.sol"; // TODO: switch to "openzeppelin-solidity/contracts/access/Ownable.sol";
import "./ISidechainMigrationManager.sol";

contract DataUnionFactorySidechain is Ownable {
    event SidechainDUCreated(address indexed mainnet, address indexed sidenet, address indexed owner, address template);
    event UpdateNewDUInitialEth(uint amount);
    event UpdateNewDUOwnerInitialEth(uint amount);
    event UpdateDefaultNewMemberInitialEth(uint amount);
    event DUInitialEthSent(uint amountWei);
    event OwnerInitialEthSent(uint amountWei);

    address public dataUnionSidechainTemplate;
    // when sidechain DU is created, the factory sends a bit of sETH to the DU and the owner
    uint public newDUInitialEth;
    uint public newDUOwnerInitialEth;
    uint public defaultNewMemberEth;
    ISidechainMigrationManager public migrationManager;

    constructor(address _migrationManager, address _dataUnionSidechainTemplate) public Ownable(msg.sender) {
        migrationManager = ISidechainMigrationManager(_migrationManager);
        dataUnionSidechainTemplate = _dataUnionSidechainTemplate;
    }

    function amb() public view returns (IAMB) {
        return IAMB(ITokenMediator(migrationManager.currentMediator()).bridgeContract());
    }

    function token() public view returns (address) {
        return migrationManager.currentToken();
    }
    

    //contract is payable
    receive() external payable {}

    function setNewDUInitialEth(uint val) public onlyOwner {
        if(val == newDUInitialEth) return;
        newDUInitialEth = val;
        emit UpdateNewDUInitialEth(val);
    }

    function setNewDUOwnerInitialEth(uint val) public onlyOwner {
        if(val == newDUOwnerInitialEth) return;
        newDUOwnerInitialEth = val;
        emit UpdateNewDUOwnerInitialEth(val);
    }

    function setNewMemberInitialEth(uint val) public onlyOwner {
        if(val == defaultNewMemberEth) return;
        defaultNewMemberEth = val;
        emit UpdateDefaultNewMemberInitialEth(val);
    }


    function sidechainAddress(address mainnetAddress)
        public view
        returns (address proxy)
    {
        return CloneLib.predictCloneAddressCreate2(dataUnionSidechainTemplate, address(this), bytes32(uint256(mainnetAddress)));
    }

    /*
    Must be called by AMB. Use MockAMB for testing.
    salt = mainnet_address.
    */
    
    function deployNewDUSidechain(address payable owner, address[] memory agents) public returns (address) {
        require(msg.sender == address(amb()), "only_AMB");
        address duMainnet = amb().messageSender();
        bytes32 salt = bytes32(uint256(duMainnet));
        bytes memory data = abi.encodeWithSignature("initialize(address,address,address[],address,uint256)",
            owner,
            migrationManager,
            agents,
            duMainnet,
            defaultNewMemberEth
        );
        address payable du = CloneLib.deployCodeAndInitUsingCreate2(CloneLib.cloneBytecode(dataUnionSidechainTemplate), data, salt);
        emit SidechainDUCreated(duMainnet, du, owner, dataUnionSidechainTemplate);

        // continue whether or not send succeeds
        if (newDUInitialEth != 0 && address(this).balance >= newDUInitialEth) {
            if (du.send(newDUInitialEth)) {
                emit DUInitialEthSent(newDUInitialEth);
            }
        }
        if (newDUOwnerInitialEth != 0 && address(this).balance >= newDUOwnerInitialEth) {
            // solhint-disable-next-line multiple-sends
            if (owner.send(newDUOwnerInitialEth)) {
                emit OwnerInitialEthSent(newDUOwnerInitialEth);
            }
        }
        return du;
    }
}
