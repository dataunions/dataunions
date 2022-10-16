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

    function distribute(address payable[] memory members, uint[] memory shareFractions) public isSorted(shareFractions) hasEqualLength(members, shareFractions) sharesAddUpTo1(shareFractions) {
        uint pSent = 0;
        uint tokenBalance = token.balanceOf(address(this));
        for(uint i=0; i < shareFractions.length; i++) {
            uint p = shareFractions[i] - pSent;
            uint tokenWei = (tokenBalance * p * dataUnion.activeMemberCount()) / (1 ether);
            token.transfer(address(dataUnion), tokenWei);
            dataUnion.refreshRevenue();
            pSent += p;
            removeMembers(i, members, shareFractions);
        }
        dataUnion.addMembers(members);
    }

    function removeMembers(uint position, address payable[] memory members, uint[] memory shareFractions) private {
        for(uint x=position; x < members.length; x++) {
            if(shareFractions[position] != shareFractions[x]) {
                break;
            } else {
                dataUnion.partMember(members[x]);
             }
        }
    }

    modifier isSorted(uint[] memory shareFractions) {
        bool sorted = true;
        for(uint i=1; i < shareFractions.length; i++) {
            if(shareFractions[i] < shareFractions[i-1]) {
                sorted = false;
                break;
            }
        }
        require(sorted, "Array not sorted");
        _;
    }

    modifier hasEqualLength(address payable[] memory members, uint[] memory shareFractions) {
        require(members.length == shareFractions.length, "Array length must be equal");
        _;
    }

    modifier sharesAddUpTo1(uint[] memory shareFractions) {
        uint x = 0;
        for(uint i = 0; i < shareFractions.length; i++) {
            x += shareFractions[i];
        }
        require(x == 1 ether, "Shares must add up to 1");
        _;
    }
}
