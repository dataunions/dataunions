// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

import "../IERC677.sol";

interface IMemberWeightModule {
    function getMemberWeight(address member) external view returns (uint256);
    function getTotalWeight() external view returns (uint256);
}
