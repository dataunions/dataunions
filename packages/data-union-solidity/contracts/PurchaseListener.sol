// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

/**
 * PurchaseListener gets a chance to react when a data subscription is bought on the Streamr Marketplace
 *   where the PurchaseListener is set as the data product's beneficiary.
 */
interface PurchaseListener {
    // TODO: find out about how to best detect who implements an interface
    //   see at least https://github.com/ethereum/EIPs/blob/master/EIPS/eip-165.md
    // function isPurchaseListener() external returns (bool);

    /**
     * Similarly to ETH transfer, returning false will decline the transaction
     *   (declining should probably cause revert, but that's up to the caller)
     * IMPORTANT: include onlyMarketplace modifier to your implementations!
     */
    function onPurchase(bytes32 productId, address subscriber, uint endTimestamp, uint priceDatacoin, uint feeDatacoin)
        external returns (bool accepted);
}
