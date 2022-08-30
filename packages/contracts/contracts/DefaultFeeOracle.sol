// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

import "./IFeeOracle.sol";
import "./Ownable.sol";

contract DefaultFeeOracle is Ownable, IFeeOracle {
    uint public fee;
    address public override beneficiary;

    event FeeChanged(uint newFeeWei);
    event BeneficiaryChanged(address newProtocolFeeBeneficiaryAddress);

    constructor(uint feeWei, address protocolFeeBeneficiaryAddress) Ownable(msg.sender) {
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
}
