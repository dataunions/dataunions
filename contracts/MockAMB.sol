pragma solidity ^0.6.0;

contract MockAMB {
    function requireToPassMessage(
        address _contract,
        bytes memory, // _data,
        uint256 // _gas
    ) public returns (bytes32) {
        return bytes32(bytes20(_contract));
    }
}
