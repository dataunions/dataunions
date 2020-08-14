pragma solidity ^0.6.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/access/Ownable.sol";

/**
 * ERC20Mintable that is missing from openzeppelin-contracts 3.x
 */
contract ERC20Mintable is ERC20, Ownable {
    constructor (string memory name, string memory symbol) public ERC20(name, symbol) {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * Token contract owner can create tokens
     * @param recipient address where new tokens are transferred (from 0x0)
     * @param amount scaled so that 10^18 equals 1 token (multiply by 10^18)
     */
    function mint(address recipient, uint amount) external onlyOwner {
        _mint(recipient, amount);
    }
}
