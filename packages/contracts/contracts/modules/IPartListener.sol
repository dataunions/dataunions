// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

import "../LeaveConditionCode.sol";

interface IPartListener {
    /** @dev IMPORTANT: add onlyDataUnion modifier to this function */
    function onPart(address leavingMember, LeaveConditionCode leaveConditionCode) external;
}
