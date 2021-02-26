pragma solidity 0.6.6;

import "./Ownable.sol"; // TODO: switch to "openzeppelin-solidity/contracts/access/Ownable.sol";
import "./FactoryConfig.sol";

contract MainnetMigrationManager is Ownable, FactoryConfig {

    event OldTokenChange(address indexed current, address indexed prev);
    event CurrentTokenChange(address indexed current, address indexed prev);
    event CurrentMediatorChange(address indexed current, address indexed prev);

    address override public currentToken;
    address override public currentMediator;
    
    constructor() public Ownable(msg.sender) {}

    function setCurrentToken(address currentToken_) public onlyOwner {
        emit CurrentTokenChange(currentToken_, currentToken);
        currentToken = currentToken_;
    }

    function setCurrentMediator(address currentMediator_) public onlyOwner {
        emit CurrentMediatorChange(currentMediator_, currentMediator);
        currentMediator = currentMediator_;
    }

}