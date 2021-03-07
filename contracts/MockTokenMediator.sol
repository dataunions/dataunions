pragma solidity 0.6.6;
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./ISingleTokenMediator.sol";

contract MockTokenMediator is ISingleTokenMediator {
    ERC20 public token;
    address public amb;
    constructor(address _token, address _amb) public {
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
        require(token.transferFrom(msg.sender, _receiver, _value), "transfer_rejected_in_mock");
    }

    function relayTokensAndCall(address _token, address _receiver, uint256 _value, bytes memory) override public {
        require(_token == address(token), "wrong_token");
        relayTokens(_receiver, _value);
    }
}
