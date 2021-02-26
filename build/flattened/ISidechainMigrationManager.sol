
// File: contracts/FactoryConfig.sol

pragma solidity 0.6.6;

interface FactoryConfig {
    function currentToken() external view returns (address);
    function currentMediator() external view returns (address);
}

// File: contracts/ISidechainMigrationManager.sol

pragma solidity 0.6.6;


interface ISidechainMigrationManager is FactoryConfig {
    function oldToken() external view returns (address);
    function swap(uint amount) external;
}
