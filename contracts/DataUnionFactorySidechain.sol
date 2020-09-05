pragma solidity ^0.6.0;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./CloneLib.sol";
import "./IAMB.sol";
import "./ITokenMediator.sol";
import "./Ownable.sol"; // TODO: switch to "openzeppelin-solidity/contracts/access/Ownable.sol";

contract DataUnionFactorySidechain is Ownable{
    event SidechainDUCreated(address indexed mainnet, address indexed sidenet, address indexed owner, address template);
    event UpdateNewDUInitialEth(uint amount);
    event UpdateNewDUOwnerInitialEth(uint amount);
    event UpdateDefaultNewMemberInitialEth(uint amount);
    event DUInitialEthSent(uint amountWei);
    event OwnerInitialEthSent(uint amountWei);

    address public data_union_sidechain_template;
    IAMB public amb;
    ITokenMediator public token_mediator;
    
    // when sidechain DU is created, the factory sends a bit of sETH to the DU and the owner
    uint public newDUInitialEth;
    uint public newDUOwnerInitialEth;
    uint public defaultNewMemberEth;

    constructor(address _token_mediator, address _data_union_sidechain_template) public Ownable(msg.sender) {
        token_mediator = ITokenMediator(_token_mediator);
        data_union_sidechain_template = _data_union_sidechain_template;
        amb = IAMB(token_mediator.bridgeContract());
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


    function sidechainAddress(address mainet_address)
        public view
        returns (address proxy)
    {
        return CloneLib.predictCloneAddressCreate2(data_union_sidechain_template, address(this), bytes32(uint256(mainet_address)));
    }

    /*
    Must be called by AMB. Use MockAMB for testing.
    salt = mainnet_address.
    */
    
    function deployNewDUSidechain(address payable owner, address[] memory agents) public returns (address) {
        require(msg.sender == address(amb), "only_AMB");
        address duMainnet = amb.messageSender();
        bytes32 salt = bytes32(uint256(duMainnet));
        bytes memory data = abi.encodeWithSignature("initialize(address,address,address[],address,address,uint256)",
            owner,
            token_mediator.erc677token(),
            agents,
            address(token_mediator),
            duMainnet,
            defaultNewMemberEth
        );
        address payable du = CloneLib.deployCodeAndInitUsingCreate2(CloneLib.cloneBytecode(data_union_sidechain_template), data, salt);
        require(du != address(0), "error_du_already_created");
        emit SidechainDUCreated(duMainnet, du, owner, data_union_sidechain_template);

        // continue whether or not send succeeds
        if (newDUInitialEth > 0 && address(this).balance >= newDUInitialEth) {
            if (du.send(newDUInitialEth)) {
                DUInitialEthSent(newDUInitialEth);
            }
        }
        if (newDUOwnerInitialEth > 0 && address(this).balance >= newDUOwnerInitialEth) {
            if (initialOwner.send(newDUOwnerInitialEth)) {
                OwnerInitialEthSent(newDUOwnerInitialEth);
            }
        }
        return du;
    }
}
