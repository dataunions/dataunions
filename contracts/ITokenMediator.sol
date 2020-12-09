pragma solidity 0.6.6;

interface ITokenMediator {
    function bridgeContract() external view returns (address);

    // The new mediator contracts relayTokens() have no from arg and always relay from msg.sender
    // multi-token mediator uses this method
    function relayTokens(address erc20, address _receiver, uint256 _value) external;
    // single-token mediator uses this method
    function relayTokens(address _receiver, uint256 _value) external;
    
    //returns:
    //Multi-token mediator: 0xb1516c26 == bytes4(keccak256(abi.encodePacked("multi-erc-to-erc-amb")))
    //Single-token mediator: 0x76595b56 ==  bytes4(keccak256(abi.encodePacked("erc-to-erc-amb")))
    function getBridgeMode() external pure returns (bytes4 _data);

}
