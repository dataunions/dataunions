pragma solidity 0.6.6;
import "./ITokenMediator.sol";

interface IMultiTokenMediator is ITokenMediator {
    // The new mediator contracts relayTokens() have no from arg and always relay from msg.sender
    // multi-token mediator uses this method
    function relayTokens(address erc20, address _receiver, uint256 _value) external;
    function homeTokenAddress(address _foreignToken) external view returns (address);
    function withinLimit(address _token, uint256 _amount) external view returns (bool);
    function dailyLimit(address _token) external view returns (uint256);
    function setDailyLimit(address _token, uint256 _dailyLimit) external;
}
