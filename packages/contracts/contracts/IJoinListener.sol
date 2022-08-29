// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

interface IJoinListener {
    function onJoin(address newMember) external;
}
