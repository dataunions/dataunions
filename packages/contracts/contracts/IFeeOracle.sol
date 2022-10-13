// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

interface IFeeOracle {
    // TODO: fee is a percentage, not absolute wei, rename it to feePercentageWei or similar
    function protocolFeeFor(address dataUnion) external view returns(uint feeWei);
    function beneficiary() external view returns(address);
}
