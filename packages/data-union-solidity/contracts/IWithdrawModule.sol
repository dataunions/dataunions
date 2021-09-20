// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

import "./IERC677.sol";

/**
 * When a withdraw happens in the DU, tokens are transferred to the withdrawModule, then this function is called.
 * The withdrawModule is then free to manage those tokens as it pleases.
 */
interface IWithdrawModule {
    function onWithdraw(address member, address to, IERC677 token, uint amountWei) external;
}
