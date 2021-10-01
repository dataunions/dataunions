// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

interface IPartListener {
    function onPart(address leavingMember) external;
}
