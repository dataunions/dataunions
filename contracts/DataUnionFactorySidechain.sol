pragma solidity ^0.6.0;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./CloneLib.sol";
import "./IAMB.sol";
import "./ITokenMediator.sol";

contract DataUnionFactorySidechain {
    event SidechainDUCreated(address indexed mainnet, address indexed sidenet, address indexed owner, address template);

    address public data_union_sidechain_template;
    IAMB public amb;
    ITokenMediator public token_mediator;
    uint public newDUInitialEth;
    uint public newDUOwnerInitialEth;

    constructor(address _token_mediator, address _data_union_sidechain_template) public {
        token_mediator = ITokenMediator(_token_mediator);
        data_union_sidechain_template = _data_union_sidechain_template;
        amb = IAMB(token_mediator.bridgeContract());
    }

    //contract is payable
    receive() external payable {}

    function sidechainAddress(address mainet_address)
        public view
        returns (address proxy)
    {
        return CloneLib.predictCloneAddressCreate2(data_union_sidechain_template, address(this), bytes32(uint256(mainet_address)));
    }

/*
    initialize(address _owner,
        address token_address,
        address[] memory agents,
        address _token_mediator,
        address _mainchain_DU)


    users can only deploy with salt = their key.
*/
    function deployNewDUSidechain(address payable owner, address[] memory agents) public returns (address) {
        address duMainnet;
        bool sendEth = false;
        if(msg.sender == address(amb)) {
            duMainnet = amb.messageSender();
            sendEth = true;
        } else {
            //if the request didnt come from AMB, use the sender's address as the corresponding "mainnet" address
            duMainnet = msg.sender;
        }
        bytes32 salt = bytes32(uint256(duMainnet));
        bytes memory data = abi.encodeWithSignature("initialize(address,address,address[],address,address)",
            owner,
            token_mediator.erc677token(),
            agents,
            address(token_mediator),
            duMainnet
        );
        address payable du = CloneLib.deployCodeAndInitUsingCreate2(CloneLib.cloneBytecode(data_union_sidechain_template), data, salt);
        require(du != address(0), "error_du_already_created");
        emit SidechainDUCreated(duMainnet, du, owner, data_union_sidechain_template);
        if(sendEth){
            //continue wheter or not send succeeds
            if(newDUInitialEth > 0 && address(this).balance >= newDUInitialEth)
                du.send(newDUInitialEth);
            if(newDUOwnerInitialEth > 0 && address(this).balance >= newDUOwnerInitialEth)
                owner.send(newDUOwnerInitialEth);
        }
        return du;
    }
}
