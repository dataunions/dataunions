
// File: contracts/MockAMB.sol

pragma solidity 0.6.6;

contract MockAMB {
    address public messageSender;
    /*
    call on LOCAL blockchain. no bridge
    */
    function requireToPassMessage(
        address _contract,
        bytes memory _data,
        uint256 _gas
    ) public returns (bytes32) {
        messageSender = msg.sender;
        (bool success, ) = _contract.call{gas: _gas}(_data);
        messageSender = address(0);
        return bytes32(byte(success ? 0x1 : 0x0));
    }
}
