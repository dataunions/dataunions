
// File: contracts/Ownable.sol

pragma solidity 0.6.6;
/**
 * @title Ownable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract Ownable {
    address public owner;
    address public pendingOwner;

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    /**
     * @dev The Ownable constructor sets the original `owner` of the contract to the sender
     * account.
     */
    constructor(address owner_) public {
        owner = owner_;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "onlyOwner");
        _;
    }

    /**
     * @dev Allows the current owner to set the pendingOwner address.
     * @param newOwner The address to transfer ownership to.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        pendingOwner = newOwner;
    }

    /**
     * @dev Allows the pendingOwner address to finalize the transfer.
     */
    function claimOwnership() public {
        require(msg.sender == pendingOwner, "onlyPendingOwner");
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }
}

// File: contracts/FactoryConfig.sol

pragma solidity 0.6.6;

interface FactoryConfig {
    function currentToken() external view returns (address);
    function currentMediator() external view returns (address);
}

// File: contracts/MainnetMigrationManager.sol

pragma solidity 0.6.6;



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
