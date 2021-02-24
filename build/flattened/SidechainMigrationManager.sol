
// File: contracts/Ownable.sol

pragma solidity 0.6.6;
/**
 * @title Ownable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract Ownable {
    address public owner;
    address public pendingOwner;

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    /**
     * @dev The Ownable constructor sets the original `owner` of the contract to the sender
     * account.
     */
    constructor(address owner_) public {
        owner = owner_;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "onlyOwner");
        _;
    }

    /**
     * @dev Allows the current owner to set the pendingOwner address.
     * @param newOwner The address to transfer ownership to.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        pendingOwner = newOwner;
    }

    /**
     * @dev Allows the pendingOwner address to finalize the transfer.
     */
    function claimOwnership() public {
        require(msg.sender == pendingOwner, "onlyPendingOwner");
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }
}

// File: contracts/ISidechainMigrationManager.sol

pragma solidity 0.6.6;

interface ISidechainMigrationManager {
    function oldToken() external view returns (address);
    function newToken() external view returns (address);
    function newMediator() external view returns (address);
    function swap(uint amount) external;
}

// File: openzeppelin-solidity/contracts/token/ERC20/IERC20.sol

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `recipient`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `sender` to `recipient` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

// File: contracts/SidechainMigrationManager.sol

pragma solidity 0.6.6;




contract SidechainMigrationManager is Ownable, ISidechainMigrationManager {

    event OldTokenChange(address indexed current, address indexed prev);
    event NewTokenChange(address indexed current, address indexed prev);
    event NewMediatorChange(address indexed current, address indexed prev);
    event Withdrawal(address indexed owner, uint amount);
    event Swap(address indexed user, uint amount);

    address override public oldToken;
    address override public newToken;
    address override public newMediator;
    
    constructor() public Ownable(msg.sender) {}

    function setOldToken(address oldToken_) public onlyOwner {
        oldToken = oldToken_;
    }

    function setNewToken(address newToken_) public onlyOwner {
        emit NewTokenChange(newToken_, newToken);
        newToken = newToken_;
    }

    function setNewMediator(address newMediator_) public onlyOwner {
        emit NewMediatorChange(newMediator_, newMediator);
        newMediator = newMediator_;
    }

    function withdraw(address tokenAddress) public onlyOwner {
        IERC20 token = IERC20(tokenAddress);
        uint bal = token.balanceOf(address(this));
        if(bal == 0) return;
        require(token.transfer(owner, bal), "transfer_failed");
        emit Withdrawal(owner, bal);
    }

    function swap(uint amount) public override {
        require(oldToken != address(0) && newToken != address(0), "tokens_not_set");
        IERC20 fromToken = IERC20(oldToken);
        IERC20 toToken = IERC20(newToken);
        require(fromToken.transferFrom(msg.sender, address(this), amount), "transfer_failed");
        require(toToken.transfer(msg.sender, amount), "transfer_failed");
        emit Swap(msg.sender, amount);
    }

}
