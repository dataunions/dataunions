pragma solidity 0.6.6;

interface ISidechainMigrationManager {
    function oldToken() external view returns (address);
    function newToken() external view returns (address);
    function newMediator() external view returns (address);
    function swap(uint amount) external;
}