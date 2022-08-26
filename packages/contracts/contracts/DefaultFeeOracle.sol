// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

import "./IFeeOracle.sol";
import "./Ownable.sol";

contract DefaultFeeOracle is Ownable, IFeeOracle {
    uint public fee;

    constructor(uint feeWei) Ownable(msg.sender) {
        setFee(feeWei);
    }

    function setFee(uint feeWei) public onlyOwner {
        fee = feeWei;
    }

    function protocolFeeFor(address) override public view returns(uint feeWei) {
        return fee;
    }
}
