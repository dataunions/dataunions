// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

import "./IERC677.sol";

interface IPartListener {
    function onPart(address leavingMember) external;
}
