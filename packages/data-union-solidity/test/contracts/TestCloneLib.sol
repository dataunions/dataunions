// SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import "truffle/Assert.sol";
import "../../contracts/CloneLib.sol";

contract TestCloneLib {

    uint256 public myValue = 0;
    function init(uint256 newValue) public {
        myValue = newValue;
    }

    // function deployCodeAndInitUsingCreate2(
    //     bytes memory code,
    //     bytes memory initData,
    //     bytes32 salt
    // ) internal returns (address proxy)
    function testDeployCodeAndInitUsingCreate2() public {
        uint256 dummyValue = 3;
        bytes memory data = abi.encodeWithSignature("init(uint256)", dummyValue);
        bytes32 salt = 0x0000000000000000000000000000000000000000000000000000000000000003;
        address a = CloneLib.deployCodeAndInitUsingCreate2(CloneLib.cloneBytecode(address(this)), data, salt);
        TestCloneLib c = TestCloneLib(a);
        Assert.equal(c.myValue(), dummyValue, "Initialization failed");
        Assert.equal(a, 0x99Df1631b3BBc2Bc6826c102BbFc35f2D414C858, "Address from CREATE2");
    }

    // function deployCodeAndInitUsingCreate(
    //     bytes memory code,
    //     bytes memory initData
    // ) internal returns (address proxy) {
    function testDeployCodeAndInitUsingCreate() public {
        uint256 dummyValue = 5;
        bytes memory data = abi.encodeWithSignature("init(uint256)", dummyValue);
        address a = CloneLib.deployCodeAndInitUsingCreate(CloneLib.cloneBytecode(address(this)), data);
        TestCloneLib c = TestCloneLib(a);
        Assert.equal(c.myValue(), dummyValue, "Initialization failed");
    }
}