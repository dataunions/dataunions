pragma solidity 0.6.6;

interface ISidechainMigrationManager {
    function newToken() external returns (address);
    function newMediator() external returns (address);
}