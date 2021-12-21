// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

import "./IERC677.sol";
import "./LeaveConditionCode.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

interface IDataUnionUpgradable  {
    function owner() external returns (address);
    function removeMember(address member, LeaveConditionCode leaveCondition) external;
    function addMember(address newMember) external;
    function isMember(address member) external view returns (bool);
}

contract DataUnionModuleUpgradable is Initializable{
    address public dataUnion;

    modifier onlyOwner() {
        require(msg.sender == IDataUnionUpgradable(dataUnion).owner(), "error_onlyOwner");
        _;
    }

    modifier onlyDataUnion() {
        require(msg.sender == dataUnion, "error_onlyDataUnionContract");
        _;
    }

    constructor() {
    }

    function initialize(address dataUnionAddress) public virtual initializer{
        dataUnion = dataUnionAddress;
    }
}
