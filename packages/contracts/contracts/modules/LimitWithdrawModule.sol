// SPDX-License-Identifier: UNLICENSED
/* solhint-disable not-rely-on-time */

pragma solidity 0.8.6;

import "../IERC677.sol";
import "./DataUnionModule.sol";
import "./IWithdrawModule.sol";
import "./IJoinListener.sol";
import "./IPartListener.sol";

/**
 * @title Data Union module that limits per-user withdraws to given amount per period
 * @dev Setup: dataUnion.setWithdrawModule(this); dataUnion.addJoinListener(this); dataUnion.addPartListener(this)
 */
contract LimitWithdrawModule is DataUnionModule, IWithdrawModule, IJoinListener, IPartListener {
    uint public requiredMemberAgeSeconds;
    uint public withdrawLimitPeriodSeconds;
    uint public withdrawLimitDuringPeriod;
    uint public minimumWithdrawTokenWei;

    mapping (address => uint) public memberJoinTimestamp;
    mapping (address => uint) public lastWithdrawTimestamp;
    mapping (address => uint) public withdrawnDuringPeriod;
    mapping (address => bool) public blackListed;

    event ModuleReset(address newDataUnion, uint newRequiredMemberAgeSeconds, uint newWithdrawLimitPeriodSeconds, uint newWithdrawLimitDuringPeriod, uint newMinimumWithdrawTokenWei);

    constructor(
        address dataUnionAddress,
        uint newRequiredMemberAgeSeconds,
        uint newWithdrawLimitPeriodSeconds,
        uint newWithdrawLimitDuringPeriod,
        uint newMinimumWithdrawTokenWei
    ) DataUnionModule(dataUnionAddress) {
        requiredMemberAgeSeconds = newRequiredMemberAgeSeconds;
        withdrawLimitPeriodSeconds = newWithdrawLimitPeriodSeconds;
        withdrawLimitDuringPeriod = newWithdrawLimitDuringPeriod;
        minimumWithdrawTokenWei = newMinimumWithdrawTokenWei;
    }

    function setParameters(
        address dataUnionAddress,
        uint newRequiredMemberAgeSeconds,
        uint newWithdrawLimitPeriodSeconds,
        uint newWithdrawLimitDuringPeriod,
        uint newMinimumWithdrawTokenWei
    ) external onlyOwner {
        dataUnion = IDataUnion(dataUnionAddress);
        requiredMemberAgeSeconds = newRequiredMemberAgeSeconds;
        withdrawLimitPeriodSeconds = newWithdrawLimitPeriodSeconds;
        withdrawLimitDuringPeriod = newWithdrawLimitDuringPeriod;
        minimumWithdrawTokenWei = newMinimumWithdrawTokenWei;
        emit ModuleReset(address(dataUnion), requiredMemberAgeSeconds, withdrawLimitPeriodSeconds, withdrawLimitDuringPeriod, minimumWithdrawTokenWei);
    }

    /**
     * (Re-)start the "age counter" for new members
     * Design choice: restart it also for those who have been members before (and thus maybe already previously waited the cooldown period).
     * Reasoning: after re-joining, the member has accumulated new earnings, and those new earnings should have the limitation period.
     *   Anyway, the member has the chance to withdraw BEFORE joining again, so restarting the "age counter" doesn't prevent withdrawing the old earnings (before re-join).
     */
    function onJoin(address newMember) override external onlyDataUnion {
        memberJoinTimestamp[newMember] = block.timestamp;

        // undo a previously banned member's withdraw limitation, see onPart
        delete blackListed[newMember];
    }

    /**
     * Design choice: banned members will not be able to withdraw until they re-join.
     *   Just removing the ban isn't enough because this module won't know about it.
     *   However, BanModule.restore causes a re-join, so it works fine.
     */
    function onPart(address leavingMember, LeaveConditionCode leaveConditionCode) override external onlyDataUnion {
        if (leaveConditionCode == LeaveConditionCode.BANNED) {
            blackListed[leavingMember] = true;
        }
    }

    function getWithdrawLimit(address member, uint maxWithdrawable) override external view returns (uint256) {
        return blackListed[member] ? 0 : maxWithdrawable;
    }

    /** Admin function to set join timestamp, e.g. for migrating old users */
    function setJoinTimestamp(address member, uint timestamp) external onlyOwner {
        memberJoinTimestamp[member] = timestamp;
    }

    /**
     * When a withdraw happens in the DU, tokens are transferred to the withdrawModule, then this function is called.
     * When we revert here, the whole withdraw transaction is reverted.
     */
    function onWithdraw(address member, address to, IERC677 token, uint amountWei) override external onlyDataUnion {
        require(amountWei >= minimumWithdrawTokenWei, "error_withdrawAmountBelowMinimum");
        require(memberJoinTimestamp[member] > 0, "error_mustJoinBeforeWithdraw");
        require(block.timestamp >= memberJoinTimestamp[member] + requiredMemberAgeSeconds, "error_memberTooNew");

        // if the withdraw period is over, we reset the counters
        if (block.timestamp > lastWithdrawTimestamp[member] + withdrawLimitPeriodSeconds) {
            lastWithdrawTimestamp[member] = block.timestamp;
            withdrawnDuringPeriod[member] = 0;
        }
        withdrawnDuringPeriod[member] += amountWei;
        require(withdrawnDuringPeriod[member] <= withdrawLimitDuringPeriod, "error_withdrawLimit");

        // transferAndCall also enables transfers over another token bridge
        //   in this case to=another bridge's tokenMediator, and from=recipient on the other chain
        // this follows the tokenMediator API: data will contain the recipient address, which is the same as sender but on the other chain
        // in case transferAndCall recipient is not a tokenMediator, the data can be ignored (it contains the DU member's address)
        require(token.transferAndCall(to, amountWei, abi.encodePacked(member)), "error_transfer");
    }
}