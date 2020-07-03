pragma solidity ^0.6.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

/*
ERC20Mintable is missing from open-zeppelin 3.0
https://forum.openzeppelin.com/t/where-is-erc20mintable-sol-in-openzeppelin-contracts-3-0/2283
*/
contract ERC20Mintable is ERC20 {
    address private creator;
    constructor(string memory name, string memory symbol) public ERC20(name, symbol) {
        creator = msg.sender;
    }

    function mint(address receipient, uint amount) public {
       require(msg.sender == creator, "only_creator");
       _mint(receipient, amount);
    }
}
