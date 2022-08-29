// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

interface IFeeOracle {
    function protocolFeeFor(address dataUnion) external view returns(uint feeWei);
}
