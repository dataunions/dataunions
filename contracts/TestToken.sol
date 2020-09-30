pragma solidity 0.6.6;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "./IERC677.sol";

/**
 * Mintable TestToken for contract tests
 * Transfers of 666 are rejected with return value false
 */
contract TestToken is ERC20, Ownable, IERC677 {
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

    function transfer(address to, uint256 amount) public override(IERC20, ERC20) returns (bool) {
        return amount == 666 ? false : super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override(IERC20, ERC20) returns (bool) {
        return amount == 666 ? false :
               amount == 777 ? true : super.transferFrom(from, to, amount);
    }

    // This is needed to check how sending to mainnet works
    // Must trigger both branches of
    //   require(token.transferAndCall(tokenMediator, amount, toBytes(to)), "error_transfer");
    // So returns false if amount = 666
    function transferAndCall(
        address,
        uint256 amount,
        bytes calldata
    ) external override returns (bool) {
        return amount != 666;
    }
}
