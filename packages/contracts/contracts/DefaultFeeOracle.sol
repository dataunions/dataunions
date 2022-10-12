// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

// upgradeable proxy imports
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./IFeeOracle.sol";

contract DefaultFeeOracle is Initializable, OwnableUpgradeable, UUPSUpgradeable, IFeeOracle {
    uint public fee;
    address public override beneficiary;

    // TODO: fee is a percentage, not absolute wei, rename it to feePercentageWei or similar
    event FeeChanged(uint newFeeWei);
    event BeneficiaryChanged(address newProtocolFeeBeneficiaryAddress);

    function initialize(uint feeWei, address protocolFeeBeneficiaryAddress) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        setFee(feeWei);
        setBeneficiary(protocolFeeBeneficiaryAddress);
    }

    function setFee(uint feeWei) public onlyOwner {
        fee = feeWei;
        emit FeeChanged(feeWei);
    }

    function setBeneficiary(address protocolFeeBeneficiaryAddress) public onlyOwner {
        beneficiary = protocolFeeBeneficiaryAddress;
        emit BeneficiaryChanged(protocolFeeBeneficiaryAddress);
    }

    function protocolFeeFor(address) override public view returns(uint feeWei) {
        return fee;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
