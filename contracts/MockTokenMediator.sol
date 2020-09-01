pragma solidity ^0.6.0;
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./ITokenMediator.sol";

contract MockTokenMediator is ITokenMediator {
    ERC20 public token;
    address public amb;
    constructor(address _token, address _amb) public {
        token = ERC20(_token);
        amb = _amb;
    }

    function erc677token() override public view returns (address) {
        return address(token);
    }

    function bridgeContract() override public view returns (address) {
        return amb;
    } 

    /*
        transfers to address on local network
    */
    function relayTokens(address _from, address _receiver, uint256 _value) override public {
        require(token.transferFrom(_from, _receiver, _value), "transfer_failed2");
    }

}
