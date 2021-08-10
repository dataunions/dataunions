pragma solidity 0.6.6;

// Tokenbridge Arbitrary Message Bridge
interface IAMB {

    //only on mainnet AMB:
    function executeSignatures(bytes calldata _data, bytes calldata _signatures) external;

    function messageSender() external view returns (address);

    function maxGasPerTx() external view returns (uint256);

    function transactionHash() external view returns (bytes32);

    function messageId() external view returns (bytes32);

    function messageSourceChainId() external view returns (bytes32);

    function messageCallStatus(bytes32 _messageId) external view returns (bool);

    function requiredSignatures() external view returns (uint256);
    function numMessagesSigned(bytes32 _message) external view returns (uint256);
    function signature(bytes32 _hash, uint256 _index) external view returns (bytes memory);
    function message(bytes32 _hash) external view returns (bytes memory);
    function failedMessageDataHash(bytes32 _messageId)
        external
        view
        returns (bytes32);

    function failedMessageReceiver(bytes32 _messageId)
        external
        view
        returns (address);

    function failedMessageSender(bytes32 _messageId)
        external
        view
        returns (address);

    function requireToPassMessage(
        address _contract,
        bytes calldata _data,
        uint256 _gas
    ) external returns (bytes32);
}
