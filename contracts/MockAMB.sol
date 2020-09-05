pragma solidity ^0.6.0;

contract MockAMB {
    address public messageSender;
    event ContractCallSuccess(bool wasSuccess);
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
        emit ContractCallSuccess(success);
        messageSender = address(0);
        return bytes32(byte(success ? 0x1 : 0x0));
    }
}
