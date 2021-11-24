// SPDX-License-Identifier: MIT
/* solhint-disable not-rely-on-time */

pragma solidity 0.8.6;

import "./DataUnionModule.sol";
import "./IJoinListener.sol";

/**
 * @title Data Union module that limits per-user withdraws to given amount per period
 * @dev Setup: dataUnion.setJoinListener(this); dataUnion.addJoinPartAgent(this);
 */
contract BanModule is DataUnionModule, IJoinListener {
    mapping(address => uint) public bannedUntilTimestamp;

    event MemberBanned(address indexed member);
    event BanWillEnd(address indexed member, uint banEndTimestamp);
    event BanRemoved(address indexed member);

    constructor(address dataUnionAddress) DataUnionModule(dataUnionAddress) {}

    function isBanned(address member) public view returns (bool) {
        return block.timestamp < bannedUntilTimestamp[member];
    }

    /** CHeck if these members are banned */
    function AreBanned(address[] memory members) public view returns (bool[] memory) {
        bool[] memory ret = new bool[](members.length);
        for (uint8 i = 0; i < members.length; ++i) {
            ret[i] = isBanned(members[i]);
        }
        return ret;
    }

    /** Ban a member indefinitely */
    function ban(address member) public onlyJoinPartAgent {
        bannedUntilTimestamp[member] = type(uint).max;
        if (IDataUnion(dataUnion).isMember(member)) {
            IDataUnion(dataUnion).removeMember(member, LeaveConditionCode.BANNED);
        }
        emit MemberBanned(member);
    }

    /** Ban members indefinitely */
    function banMembers(address[] memory members) public onlyJoinPartAgent {
        for (uint8 i = 0; i < members.length; ++i) {
            ban(members[i]);
        }
    }


    /** Ban a member for a specific time period (given in seconds) */
    function banSeconds(address member, uint banLengthSeconds) public onlyJoinPartAgent {
        ban(member);
        bannedUntilTimestamp[member] = block.timestamp + banLengthSeconds;
        emit BanWillEnd(member, bannedUntilTimestamp[member]);
    }

    /** Ban members for a specific time period (given in seconds) */
    function banMembersForSpecificSeconds(address[] memory members, uint banLengthSeconds) public onlyJoinPartAgent {
        for (uint8 i = 0; i < members.length; ++i) {
            banSeconds(members[i], banLengthSeconds);
        }
    }

    /** Ban members for a specific time period (given in seconds for each user) */
    function banMembersSeconds(address[] memory members, uint[] memory banLengthSeconds) public onlyJoinPartAgent {
        for (uint8 i = 0; i < members.length; ++i) {
            banSeconds(members[i], banLengthSeconds[i]);
        }
    }

    /** Reverse a ban and re-join the member to the data union */
    function restore(address member) public onlyJoinPartAgent {
        require(isBanned(member), "error_memberNotBanned");
        removeBan(member);
        IDataUnion(dataUnion).addMember(member);
    }

    /** Reverse ban and re-join the members to the data union */
    function restoreMembers(address[] memory members) public onlyJoinPartAgent {
        for (uint8 i = 0; i < members.length; ++i) {
            restore(members[i]);
        }
    }

    /** Remove a ban without re-joining the member */
    function removeBan(address member) public onlyJoinPartAgent {
        delete bannedUntilTimestamp[member];
        emit BanRemoved(member);
    }

    /** Remove ban without re-joining the members */
    function removeBanMembers(address[] memory members) public onlyJoinPartAgent {
        for (uint8 i = 0; i < members.length; ++i) {
            removeBan(members[i]);
        }
    }

    /** Callback that gets called when a member wants to join */
    function onJoin(address newMember) override view external onlyDataUnion {
        require(!isBanned(newMember), "error_memberBanned");
    }
}
