pragma solidity 0.6.6;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Burnable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/utils/Address.sol";
import "./ERC20Mintable.sol";
import "./IERC677.sol";

/**
 * @title ERC677BridgeToken
 * @dev The basic implementation of a bridgeable ERC677-compatible token
 */
contract ERC677BridgeToken is ERC20Mintable, IERC677 {
    address internal bridgeContractAddr;

    event ContractFallbackCallFailed(address from, address to, uint256 value);

    /**
     * NOTE: _decimals is ignored! All tokens should have 18 decimals (regards, openzeppelin)
     */
    constructor(string memory _name, string memory _symbol, uint8 _decimals) public ERC20Mintable(_name, _symbol) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function bridgeContract() external view returns (address) {
        return bridgeContractAddr;
    }

    function setBridgeContract(address _bridgeContract) external onlyOwner {
        require(Address.isContract(_bridgeContract));
        bridgeContractAddr = _bridgeContract;
    }

    modifier validRecipient(address _recipient) {
        require(_recipient != address(0) && _recipient != address(this));
        /* solcov ignore next */
        _;
    }

    function transferAndCall(address _to, uint256 _value, bytes calldata _data) override external validRecipient(_to) returns (bool) {
        require(superTransfer(_to, _value));
        emit Transfer(msg.sender, _to, _value, _data);

        if (Address.isContract(_to)) {
            require(contractFallback(msg.sender, _to, _value, _data));
        }
        return true;
    }

    function getTokenInterfacesVersion() external pure returns (uint64 major, uint64 minor, uint64 patch) {
        return (2, 2, 0);
    }

    function superTransfer(address _to, uint256 _value) internal returns (bool) {
        return super.transfer(_to, _value);
    }

    function transfer(address _to, uint256 _value) override(ERC20, IERC20) public returns (bool) {
        require(superTransfer(_to, _value));
        callAfterTransfer(msg.sender, _to, _value);
        return true;
    }

    function transferFrom(address _from, address _to, uint256 _value) override(ERC20, IERC20) public returns (bool) {
        require(super.transferFrom(_from, _to, _value));
        callAfterTransfer(_from, _to, _value);
        return true;
    }

    function callAfterTransfer(address _from, address _to, uint256 _value) internal {
        if (Address.isContract(_to) && !contractFallback(_from, _to, _value, new bytes(0))) {
            require(!isBridge(_to));
            emit ContractFallbackCallFailed(_from, _to, _value);
        }
    }

    function isBridge(address _address) public view returns (bool) {
        return _address == bridgeContractAddr;
    }

    /**
     * @dev call onTokenTransfer fallback on the token recipient contract
     * @param _from tokens sender
     * @param _to tokens recipient
     * @param _value amount of tokens that was sent
     * @param _data set of extra bytes that can be passed to the recipient
     */
    function contractFallback(address _from, address _to, uint256 _value, bytes memory _data) private returns (bool) {
        (bool success,) = _to.call(abi.encodeWithSignature("onTokenTransfer(address,uint256,bytes)", _from, _value, _data));
        return success;
    }

    function renounceOwnership() override public onlyOwner {
        revert();
    }

    function claimTokens(address _token, address payable _to) public onlyOwner validRecipient(_to) {
        if (_token == address(0)) {
            _to.transfer(address(this).balance);
        } else {
            ERC20 token = ERC20(_token);
            uint256 balance = token.balanceOf(address(this));
            token.transfer(_to, balance);
        }
    }
}
