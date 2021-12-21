// SPDX-License-Identifier: MIT
/* solhint-disable not-rely-on-time */

pragma solidity 0.8.6;

import "./DataUnionModuleUpgradable.sol";
import "./IJoinListener.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title Data Union module that limits per-user withdraws to given amount per period
 * @dev Setup: dataUnion.setJoinListener(this); dataUnion.addJoinPartAgent(this);
 */
contract BanModuleUpgradable is Initializable, DataUnionModuleUpgradable, IJoinListener {
    mapping (address => uint) public bannedUntilTimestamp;

    event MemberBanned(address indexed member);
    event BanWillEnd(address indexed member, uint banEndTimestamp);
    event BanRemoved(address indexed member);

    constructor(){}

    function initialize(address dataUnionAddress) public override initializer{
        DataUnionModuleUpgradable.initialize(dataUnionAddress);
    }

    function isBanned(address member) public view returns (bool) {
        return block.timestamp < bannedUntilTimestamp[member];
    }

    /** Ban a member indefinitely */
    function ban(address member) public onlyOwner {
        bannedUntilTimestamp[member] = type(uint).max;
        if (IDataUnionUpgradable(dataUnion).isMember(member)) {
            IDataUnionUpgradable(dataUnion).removeMember(member, LeaveConditionCode.BANNED);
        }
        emit MemberBanned(member);
    }

    /** Ban a member for a specific time period (given in seconds) */
    function banSeconds(address member, uint banLengthSeconds) public onlyOwner {
        ban(member);
        bannedUntilTimestamp[member] = block.timestamp + banLengthSeconds;
        emit BanWillEnd(member, bannedUntilTimestamp[member]);
    }

    /** Reverse a ban and re-join the member to the data union */
    function restore(address member) public onlyOwner {
        require(isBanned(member), "error_memberNotBanned");
        removeBan(member);
        IDataUnionUpgradable(dataUnion).addMember(member);
    }

    /** Remove a ban without re-joining the member */
    function removeBan(address member) public onlyOwner {
        delete bannedUntilTimestamp[member];
        emit BanRemoved(member);
    }

    /** Callback that gets called when a member wants to join */
    function onJoin(address newMember) override view external onlyDataUnion {
        require(!isBanned(newMember), "error_memberBanned");
    }
}
