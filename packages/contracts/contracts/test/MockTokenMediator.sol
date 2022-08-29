// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../xdai-mainnet-bridge/ISingleTokenMediator.sol";
import "../IERC677Receiver.sol";

contract MockTokenMediator is ISingleTokenMediator, IERC677Receiver {

    event RelayTokens(address receiver, uint256 value);

    ERC20 public token;
    address public amb;
    constructor(address _token, address _amb) {
        token = ERC20(_token);
        amb = _amb;
    }

    function bridgeContract() override public view returns (address) {
        return amb;
    }

    //MultiAMB 0xb1516c26 == bytes4(keccak256(abi.encodePacked("multi-erc-to-erc-amb")))
    //Single token AMB 0x76595b56 ==  bytes4(keccak256(abi.encodePacked("erc-to-erc-amb")))
    function getBridgeMode() override public pure returns (bytes4 _data) {
        return 0x76595b56;
    }

    /**
     * Transfers to address on local network
     */
    function relayTokens(address _receiver, uint256 _value) override public {
        emit RelayTokens(_receiver, _value);
        require(token.transferFrom(msg.sender, _receiver, _value), "transfer_rejected_in_mock");
    }

    function relayTokensAndCall(address _token, address _receiver, uint256 _value, bytes memory) override public {
        require(_token == address(token), "wrong_token");
        relayTokens(_receiver, _value);
    }

    // from https://github.com/GNSPS/solidity-bytes-utils/blob/6458fb2780a3092bc756e737f246be1de6d3d362/contracts/BytesLib.sol#L297
    function toAddress(bytes memory _bytes) internal pure returns (address) {
        require(_bytes.length >= 20, "toAddress_outOfBounds");
        address tempAddress;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            tempAddress := div(mload(add(_bytes, 0x20)), 0x1000000000000000000000000)
        }
        return tempAddress;
    }

    /**
     * ERC677 callback
     * Mock: instead of going over the bridge, just send the tokens forward to the recipient
     */
    function onTokenTransfer(address, uint256 amount, bytes calldata data) override external {
        address recipient = toAddress(data);
        require(ERC20(msg.sender).transfer(recipient, amount), "transfer_rejected_in_mock");
    }
}
