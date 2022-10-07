// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;
import "./ITokenMediator.sol";

interface ISingleTokenMediator is ITokenMediator{
    // single-token mediator uses this method
    function relayTokens(address _receiver, uint256 _value) external;
}
