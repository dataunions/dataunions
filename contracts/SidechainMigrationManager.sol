pragma solidity 0.6.6;

import "./Ownable.sol"; // TODO: switch to "openzeppelin-solidity/contracts/access/Ownable.sol";
import "./ISidechainMigrationManager.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract SidechainMigrationManager is Ownable, ISidechainMigrationManager {

    event OldTokenChange(address indexed current, address indexed prev);
    event CurrentTokenChange(address indexed current, address indexed prev);
    event CurrentMediatorChange(address indexed current, address indexed prev);
    event Withdrawal(address indexed owner, uint amount);
    event Swap(address indexed user, address indexed fromToken, address indexed toToken, uint amount);

    address override public oldToken;
    address override public currentToken;
    address override public currentMediator;
    
    constructor() public Ownable(msg.sender) {}

    function setOldToken(address oldToken_) public onlyOwner {
        emit OldTokenChange(oldToken_, oldToken);
        oldToken = oldToken_;
    }

    function setCurrentToken(address currentToken_) public onlyOwner {
        emit CurrentTokenChange(currentToken_, currentToken);
        currentToken = currentToken_;
    }

    function setCurrentMediator(address currentMediator_) public onlyOwner {
        emit CurrentMediatorChange(currentMediator_, currentMediator);
        currentMediator = currentMediator_;
    }

    function withdraw(address tokenAddress) public onlyOwner {
        IERC20 token = IERC20(tokenAddress);
        uint bal = token.balanceOf(address(this));
        if(bal == 0) return;
        require(token.transfer(owner, bal), "transfer_failed");
        emit Withdrawal(owner, bal);
    }

    function swap(uint amount) public override {
        require(oldToken != address(0) && currentToken != address(0), "tokens_not_set");
        IERC20 fromToken = IERC20(oldToken);
        IERC20 toToken = IERC20(currentToken);
        require(fromToken.transferFrom(msg.sender, address(this), amount), "transferFrom_failed");
        require(toToken.transfer(msg.sender, amount), "transfer_failed");
        emit Swap(msg.sender, oldToken, currentToken, amount);
    }

}
