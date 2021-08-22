// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

interface IERC677 is IERC20 {
    event Transfer(
        address indexed from,
        address indexed to,
        uint256 value,
        bytes data
    );

    function transferAndCall(
        address,
        uint256,
        bytes calldata
    ) external returns (bool);
}
