pragma solidity 0.6.6;

import "./Ownable.sol"; // TODO: switch to "openzeppelin-solidity/contracts/access/Ownable.sol";
import "./IMainnetMigrationManager.sol";

contract MainnetMigrationManager is Ownable, IMainnetMigrationManager {

    event OldTokenChange(address indexed current, address indexed prev);
    event NewTokenChange(address indexed current, address indexed prev);
    event NewMediatorChange(address indexed current, address indexed prev);

    address override public newToken;
    address override public newMediator;
    
    constructor() public Ownable(msg.sender) {}

    function setNewToken(address newToken_) public onlyOwner {
        emit NewTokenChange(newToken_, newToken);
        newToken = newToken_;
    }

    function setNewMediator(address newMediator_) public onlyOwner {
        emit NewMediatorChange(newMediator_, newMediator);
        newMediator = newMediator_;
    }
    
}