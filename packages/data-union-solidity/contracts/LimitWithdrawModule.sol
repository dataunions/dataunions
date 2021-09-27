// SPDX-License-Identifier: MIT
/* solhint-disable not-rely-on-time */

pragma solidity 0.8.6;

import "./IERC677.sol";
import "./DataUnionSidechain.sol";
import "./IWithdrawModule.sol";
import "./IJoinPartListener.sol";

/**
 * @title Data Union module that limits per-user withdraws to given amount per period
 * @dev Set this module as joinPartAgent in the Data Union contract and do your joins and parts through here.
 */
contract LimitWithdrawModule is IWithdrawModule, IJoinPartListener {
    uint public requiredMemberAgeSeconds;
    uint public withdrawLimitPeriodSeconds;
    uint public withdrawLimitDuringPeriod;
    uint public minimumWithdrawTokenWei;

    mapping (address => uint) public memberJoinTimestamp;
    mapping (address => uint) public lastWithdrawTimestamp;
    mapping (address => uint) public withdrawnDuringPeriod;

    DataUnionSidechain public dataUnion;

    modifier onlyDataUnion() {
        require(msg.sender == address(dataUnion), "error_onlyDataUnionContract");
        _;
    }

    event ModuleReset(DataUnionSidechain newDataUnion, uint newRequiredMemberAgeSeconds, uint newWithdrawLimitPeriodSeconds, uint newWithdrawLimitDuringPeriod, uint newMinimumWithdrawTokenWei);

    constructor(
        DataUnionSidechain dataUnionAddress,
        uint newRequiredMemberAgeSeconds,
        uint newWithdrawLimitPeriodSeconds,
        uint newWithdrawLimitDuringPeriod,
        uint newMinimumWithdrawTokenWei
    ) {
        dataUnion = DataUnionSidechain(dataUnionAddress);
        requiredMemberAgeSeconds = newRequiredMemberAgeSeconds;
        withdrawLimitPeriodSeconds = newWithdrawLimitPeriodSeconds;
        withdrawLimitDuringPeriod = newWithdrawLimitDuringPeriod;
        minimumWithdrawTokenWei = newMinimumWithdrawTokenWei;
    }

    function setParameters(
        DataUnionSidechain dataUnionAddress,
        uint newRequiredMemberAgeSeconds,
        uint newWithdrawLimitPeriodSeconds,
        uint newWithdrawLimitDuringPeriod,
        uint newMinimumWithdrawTokenWei
    ) external {
        require(msg.sender == dataUnion.owner(), "error_onlyOwner");
        dataUnion = DataUnionSidechain(dataUnionAddress);
        requiredMemberAgeSeconds = newRequiredMemberAgeSeconds;
        withdrawLimitPeriodSeconds = newWithdrawLimitPeriodSeconds;
        withdrawLimitDuringPeriod = newWithdrawLimitDuringPeriod;
        minimumWithdrawTokenWei = newMinimumWithdrawTokenWei;
        emit ModuleReset(dataUnion, requiredMemberAgeSeconds, withdrawLimitPeriodSeconds, withdrawLimitDuringPeriod, minimumWithdrawTokenWei);
    }

    function onJoin(address newMember) override external onlyDataUnion {
        memberJoinTimestamp[newMember] = block.timestamp;
    }

    function onPart(address leavingMember) override external onlyDataUnion {
        delete memberJoinTimestamp[leavingMember];
    }

    /**
     * When a withdraw happens in the DU, tokens are transferred to the withdrawModule, then this function is called.
     * When we revert here, the whole withdraw transaction is reverted.
     */
    function onWithdraw(address member, address to, IERC677 token, uint amountWei) override external onlyDataUnion {
        require(amountWei >= minimumWithdrawTokenWei, "error_withdrawAmountBelowMinimum");
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