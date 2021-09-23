// SPDX-License-Identifier: MIT
/* solhint-disable not-rely-on-time */

pragma solidity 0.8.6;

import "./IERC677.sol";
import "./DataUnionSidechain.sol";
import "./IWithdrawModule.sol";

/**
 * @title Data Union module that limits per-user withdraws to given amount per period
 * @dev Set this module as joinPartAgent in the Data Union contract and do your joins and parts through here.
 */
contract LimitWithdrawModule is IWithdrawModule {
    uint public requiredMemberAgeSeconds;
    uint public withdrawLimitPeriodSeconds;
    uint public withdrawLimitDuringPeriod;
    uint public minimumWithdrawTokenWei;

    mapping (address => uint) public memberJoinTimestamp;
    mapping (address => uint) public lastWithdrawTimestamp;
    mapping (address => uint) public withdrawnDuringPeriod;

    DataUnionSidechain public dataUnion;

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

    /**
     * Use this function to add members instead of the usual DataUnionSidechain.addMember function
     * NOTE: Will simply do nothing if the member is already in the Data Union
     */
    function addMember(address payable newMember) public {
        require(dataUnion.isJoinPartAgent(msg.sender), "error_onlyJoinPartAgent");

        // members that have been added previously "the wrong way" to the DU directly will be simply added to tracking
        if (dataUnion.isMember(newMember)) {
            if (memberJoinTimestamp[newMember] == 0) {
                memberJoinTimestamp[newMember] = block.timestamp;
            }
        } else {
            dataUnion.addMember(newMember);
            memberJoinTimestamp[newMember] = block.timestamp;
        }
    }

    /**
     * Use this function to batch add members instead of the usual DataUnionSidechain.addMembers function
     * NOTE: Will simply do nothing for members that are already in the Data Union
     */
    function addMembers(address payable[] memory newMembers) external {
        for (uint256 i = 0; i < newMembers.length; i++) {
            addMember(newMembers[i]);
        }
    }

    /**
     * When a withdraw happens in the DU, tokens are transferred to the withdrawModule, then this function is called.
     * When we revert here, the whole withdraw transaction is reverted.
     */
    function onWithdraw(address member, address to, IERC677 token, uint amountWei) external override {
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