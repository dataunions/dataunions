pragma solidity 0.6.6;

import "./Ownable.sol"; // TODO: switch to "openzeppelin-solidity/contracts/access/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract SidechainMigrationManager is Ownable {

    event OldTokenChange(address indexed current, address indexed prev);
    event NewTokenChange(address indexed current, address indexed prev);
    event NewMediatorChange(address indexed current, address indexed prev);
    event Withdrawal(address indexed owner, uint amount);
    event Swap(address indexed user, uint amount);

    address public oldToken;
    address public newToken;
    address public newMediator;
    
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

    function swap(uint amount) public {
        require(oldToken != address(0) && newToken != address(0), "tokens_not_set");
        IERC20 fromToken = IERC20(oldToken);
        IERC20 toToken = IERC20(newToken);
        require(fromToken.transferFrom(msg.sender, address(this), amount), "transfer_failed");
        require(toToken.transfer(msg.sender, amount), "transfer_failed");
        emit Swap(msg.sender, amount);
    }


}