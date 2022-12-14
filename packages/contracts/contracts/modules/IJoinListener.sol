// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

interface IJoinListener {
    /** @dev IMPORTANT: add onlyDataUnion modifier to this function */
    function onJoin(address newMember) external;
}
