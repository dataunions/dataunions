// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

import "./IMemberWeightModule.sol";
import "./DataUnionModule.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * WeightTokenModule is a simple implementation of IMemberWeightModule.
 * It uses the balance of a token as the weight of a member.
 */
contract WeightTokenModule is ERC20, DataUnionModule, IMemberWeightModule {
    IERC20 public token;

    constructor(address dataUnion, string memory name, string memory symbol) DataUnionModule(dataUnion) ERC20(name, symbol) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function getMemberWeight(address member) override external view returns (uint256) {
        return balanceOf(member);
    }

    function getTotalWeight() override external view returns (uint256) {
        return totalSupply();
    }

    /**
     * DU admin can create tokens
     * @param recipient address where new tokens are transferred (from 0x0)
     * @param amount scaled so that 10^18 equals 1 token (multiply by 10^18)
     */
    function mint(address recipient, uint amount) external onlyOwner {
        dataUnion.checkpointMemberEarnings(recipient);
        _mint(recipient, amount);
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        dataUnion.checkpointMemberEarnings(msg.sender);
        dataUnion.checkpointMemberEarnings(to);
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        dataUnion.checkpointMemberEarnings(from);
        dataUnion.checkpointMemberEarnings(to);
        return super.transferFrom(from, to, amount);
    }
}
