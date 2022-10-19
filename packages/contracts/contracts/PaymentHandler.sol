// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

import "./DataUnionTemplate.sol";
import "hardhat/console.sol";

contract PaymentHandler {

    DataUnionTemplate public dataUnion;
    IERC677 public token;

    constructor(address payable dataUnion_, address token_) {
        dataUnion = DataUnionTemplate(dataUnion_);
        token = IERC677(token_);
    }

    /**
     * @dev After token have been transfered to THIS contract this function should be called to distribute the earnings.
     * @param members list of all active members that have to be in the same order as their associated shareFraction.
     * @param shareFractions list of the share distribution associated to the active members. Share fractions have to add up to 1 ether and must be sorted according to increasing numbers.
     */
    function distribute(address payable[] memory members, uint[] memory shareFractions) public validShares(shareFractions) validMembers(members) {
        require(msg.sender == dataUnion.owner(), "error_onlyOwner");
        require(members.length == shareFractions.length, "Array length must be equal");
        uint pSent = 0;
        uint tokenBalance = token.balanceOf(address(this));
        for(uint i=0; i < shareFractions.length; i++) {
            uint p = shareFractions[i] - pSent;
            uint tokenWei = (tokenBalance * p * dataUnion.activeMemberCount()) / (1 ether);
            token.transfer(address(dataUnion), tokenWei);
            dataUnion.refreshRevenue();
            pSent += p;
            i = removeMembers(i, members, shareFractions) - 1;
        }
        dataUnion.addMembers(members);
    }

    function removeMembers(uint position, address payable[] memory members, uint[] memory shareFractions) private returns (uint) {
        uint x=position;
        for(x; x < members.length; x++) {
            if(shareFractions[position] != shareFractions[x]) {
                break;
            } else {
                dataUnion.partMember(members[x]);
            }
        }
        return x;
    }

    modifier validShares(uint[] memory shareFractions) {
        bool sorted = true;
        uint x = 0;
        for(uint i=0; i < shareFractions.length; i++) {
            if(i>0 && shareFractions[i] < shareFractions[i-1] && sorted) {
                sorted = false;
            }
            x += shareFractions[i];
        }
        require(sorted, "Array not sorted");
        require(x == 1 ether, "Shares must add up to 1");
        _;
    }

    modifier validMembers(address payable[] memory members) {
        require(members.length == dataUnion.activeMemberCount(), "Active members don't match array");
        bool allActiveMembers = true;
        for(uint i=0; i < members.length; i++) {
            allActiveMembers = dataUnion.isMember(members[i]);
            if(!allActiveMembers) {
                break;
            }
        }
        require(allActiveMembers, "Active members don't match array");
        _;
    }
}
