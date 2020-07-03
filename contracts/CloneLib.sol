pragma solidity ^0.6.0;

library CloneLib {
    /*
        returns bytecode of a new contract that clones template
    */
    //https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-sdk/master/packages/lib/contracts/upgradeability/ProxyFactory.sol
    function cloneBytecode(address template)
        internal
        pure
        returns (bytes memory code)
    {
        // Adapted from https://github.com/optionality/clone-factory/blob/32782f82dfc5a00d103a7e61a17a5dedbd1e8e9d/contracts/CloneFactory.sol
        bytes20 targetBytes = bytes20(template);
        assembly {
            code := mload(0x40)
            //code length is 0x37 plus 0x20 for bytes length field. update free memory pointer
            mstore(0x40, add(code, 0x57))
            //store length in first 32 bytes
            mstore(code, 0x37)
            //store data after first 32 bytes
            mstore(
                add(code, 0x20),
                0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000
            )
            mstore(add(code, 0x34), targetBytes)
            mstore(
                add(code, 0x48),
                0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000
            )
        }
    }

    function predictCloneAddressCreate2(
        address template,
        address deployer,
        bytes32 salt
    ) internal pure returns (address proxy) {
        bytes32 codehash = keccak256(cloneBytecode(template));
        return
            address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                deployer,
                                salt,
                                codehash
                            )
                        )
                    )
                )
            );
    }

    function deployCodeAndInit(
        bytes memory code,
        bytes memory init_data,
        bytes32 salt
    ) internal returns (address proxy) {
        uint256 len = code.length;
        assembly {
            proxy := create2(0, add(code, 0x20), len, salt)
        }

        if (init_data.length > 0) {
            (bool success, ) = proxy.call(init_data);
            require(success);
        }
    }
}
