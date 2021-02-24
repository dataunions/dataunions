pragma solidity 0.6.6;

interface IMainnetMigrationManager {
    function newToken() external view returns (address);
    function newMediator() external view returns (address);
}