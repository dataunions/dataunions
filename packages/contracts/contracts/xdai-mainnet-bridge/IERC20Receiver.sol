// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

/*
tokenbridge callback function for receiving relayTokensAndCall()
*/
interface IERC20Receiver {
    function onTokenBridged(
        address token,
        uint256 value,
        bytes calldata data
    ) external;
}
