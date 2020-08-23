
// File: contracts/MockAMB.sol

pragma solidity ^0.6.0;

interface IAMB {
    function requireToPassMessage(
        address _contract,
        bytes calldata _data,
        uint256 _gas
    ) external returns (bytes32);
}

contract MockAMB is IAMB {
    function requireToPassMessage(
        address _contract,
        bytes memory _data,
        uint256 _gas
    ) override public returns (bytes32) {
        return bytes32(bytes20(_contract));
    }
}
