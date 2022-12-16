// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

import "../IERC677.sol";

interface IWithdrawModule {
    /**
     * When a withdraw happens in the DU, tokens are transferred to the withdrawModule, then onWithdraw function is called.
     * The withdrawModule is then free to manage those tokens as it pleases.
     */
    function onWithdraw(address member, address to, IERC677 token, uint amountWei) external;

    /**
     * WithdrawModule can also set limits to withdraws between 0 and (earnings - previously withdrawn earnings).
     */
    function getWithdrawLimit(address member, uint maxWithdrawable) external view returns (uint256);
}
