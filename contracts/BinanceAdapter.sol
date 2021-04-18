pragma solidity 0.6.6;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol"; 
import "./IERC677.sol";

contract BinanceAdapter {
    event WithdrawToBinance(address indexed token, address indexed to, uint256 amountDatacoin, uint256 amountOtheroken);

    IUniswapV2Router02 public honeyswapRouter;
    address public bscBridge;
    IERC677 public dataCoin;
    address public convertToCoin;
    /*
    ERC677 callback
    */
    function onTokenTransfer(address, uint256 amount, bytes calldata data) external returns (bool success) {
        uint256 maxint = uint256(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff);
        //min output is 1 wei, no deadline
        withdrawToBinance(toAddress(data), amount, convertToCoin, 1, maxint);
    }

    constructor(address dataCoin_, address honeyswapRouter_, address bscBridge_, address convertToCoin_) public {
        dataCoin = IERC677(dataCoin_);
        honeyswapRouter = IUniswapV2Router02(honeyswapRouter_);
        bscBridge = address(bscBridge_);
        convertToCoin = convertToCoin_;
    }


    function withdrawToBinance(address binanceAddress, uint256 amountDatacoin, address toCoinXDai, uint256 toCoinMinAmount, uint256 deadlineTimestamp) internal {
        IERC677 toCoin;
        // in toCoin:
        uint256 sendToBinanceAmount;
        if(toCoinXDai == address(dataCoin) || toCoinXDai == address(0)){
            //no conversion neeeded
            toCoin = IERC677(dataCoin);
            sendToBinanceAmount = toCoin.balanceOf(address(this));
            // err if not enough DATA coin balance
            require(sendToBinanceAmount >= amountDatacoin, "insufficient_balance");
        }
        else{
            //require(dataCoin.approve(address(honeyswapRouter), 0), "approve_failed");
            require(dataCoin.approve(address(honeyswapRouter), amountDatacoin), "approve_failed");
            address[] memory path = new address[](2);
            path[0] = address(dataCoin);
            path[1] = toCoinXDai;
            // this should err if not enough DATA coin balance
            honeyswapRouter.swapExactTokensForTokens(amountDatacoin, toCoinMinAmount, path, address(this), deadlineTimestamp);
            toCoin = IERC677(toCoinXDai);
            sendToBinanceAmount = toCoin.balanceOf(address(this));
        }
        toCoin.transferAndCall(bscBridge, sendToBinanceAmount, toBytes(binanceAddress));
        emit WithdrawToBinance(address(toCoin), binanceAddress, amountDatacoin, sendToBinanceAmount);
    }
    
    // util functions
    function toBytes(address a) public pure returns (bytes memory b) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let m := mload(0x40)
            a := and(a, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
            mstore(
                add(m, 20),
                xor(0x140000000000000000000000000000000000000000, a)
            )
            mstore(0x40, add(m, 52))
            b := m
        }
    }
    //from https://github.com/GNSPS/solidity-bytes-utils/blob/6458fb2780a3092bc756e737f246be1de6d3d362/contracts/BytesLib.sol#L297
    function toAddress(bytes memory _bytes) internal pure returns (address) {
        require(_bytes.length >= 20, "toAddress_outOfBounds");
        address tempAddress;
        assembly {
            tempAddress := div(mload(add(_bytes, 0x20)), 0x1000000000000000000000000)
        }

        return tempAddress;
    }

}