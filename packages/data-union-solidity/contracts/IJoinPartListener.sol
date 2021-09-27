// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

import "./IERC677.sol";

interface IJoinPartListener {
    function onJoin(address newMember) external;
    function onPart(address leavingMember) external;
}
