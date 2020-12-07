
// File: contracts/ITokenMediator.sol

pragma solidity 0.6.6;

interface ITokenMediator {
    function bridgeContract() external view returns (address);

    //from is msg.sender
    // multi-token bridge mediator uses this method
    function relayTokens(address erc20, address _receiver, uint256 _value) external;
    // single-token bridge mediator uses this method
    function relayTokens(address _receiver, uint256 _value) external;
    
    //returns:
    //MultiAMB 0xb1516c26 == bytes4(keccak256(abi.encodePacked("multi-erc-to-erc-amb")))
    //Single token AMB 0x76595b56 ==  bytes4(keccak256(abi.encodePacked("erc-to-erc-amb")))
    function getBridgeMode() external pure returns (bytes4 _data);

}
