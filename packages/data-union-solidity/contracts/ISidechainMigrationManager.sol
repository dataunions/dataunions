pragma solidity 0.6.6;

import "./FactoryConfig.sol";

interface ISidechainMigrationManager is FactoryConfig {
    function oldToken() external view returns (address);
    function swap(uint amount) external;
}