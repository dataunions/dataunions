// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

import "./LeaveConditionCode.sol";

interface IPartListener {
    function onPart(address leavingMember, LeaveConditionCode leaveConditionCode) external;
}
