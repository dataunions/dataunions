// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IPurchaseListener {
	/**
	 * Similarly to ETH transfer, returning false will decline the transaction
	 *   (declining should probably cause revert, but that's up to the caller)
	 * IMPORTANT: include onlyMarketplace modifier to your implementations if your logic depends on the arguments!
	 */
	function onPurchase(
		bytes32 productId,
		address subscriber,
		uint256 endTimestamp,
		uint256 priceDatacoin,
		uint256 feeDatacoin
	) external returns (bool accepted);
}
