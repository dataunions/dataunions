pragma solidity 0.6.6;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol"; 
import "./IERC677.sol";

contract BinanceAdapter {
    event WithdrawToBinance(address indexed token, address indexed to, uint256 amountDatacoin, uint256 amountOtheroken);
    event SetBinanceRecipient(address indexed member, address indexed recipient);

    IUniswapV2Router02 public honeyswapRouter;
    address public bscBridge;
    IERC677 public dataCoin;
    address public convertToCoin;
    //optional intermediate token for liquidity path
    address public liquidityToken;

    mapping(address => address) public binanceRecipient;
    /*
    ERC677 callback
    */
    function onTokenTransfer(address, uint256 amount, bytes calldata data) external returns (bool) {
        uint256 maxint = uint256(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff);
        address recipient = binanceRecipient[toAddress(data)];
        require(recipient != address(0), "recipient_undefined");
        //min output is 1 wei, no deadline
        _withdrawToBinance(recipient, amount, convertToCoin, 1, maxint);
    }

    constructor(address dataCoin_, address honeyswapRouter_, address bscBridge_, address convertToCoin_, address liquidityToken_) public {
        dataCoin = IERC677(dataCoin_);
        honeyswapRouter = IUniswapV2Router02(honeyswapRouter_);
        bscBridge = address(bscBridge_);
        convertToCoin = convertToCoin_;
        liquidityToken = liquidityToken_;
    }

    function setBinanceRecipient(address recipient) public {
        _setBinanceRecipient(msg.sender, recipient);
    }

    function setBinanceRecipientFromSig(address recipient, bytes sig) public {
        _setBinanceRecipient(getSigner(recipient, sig), recipient);
    }
    

    function _setBinanceRecipient(address member, address recipient) internal {
        binanceRecipient[member] = recipient;
        emit SetBinanceRecipient(member, recipient);
    }


    function _withdrawToBinance(address binanceAddress, uint256 amountDatacoin, address toCoinXDai, uint256 toCoinMinAmount, uint256 deadlineTimestamp) internal {
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
            require(dataCoin.approve(address(honeyswapRouter), amountDatacoin), "approve_failed");
            address[] memory path = _honeyswapPath(toCoinXDai);
            // this should err if not enough DATA coin balance
            honeyswapRouter.swapExactTokensForTokens(amountDatacoin, toCoinMinAmount, path, address(this), deadlineTimestamp);
            toCoin = IERC677(toCoinXDai);
            sendToBinanceAmount = toCoin.balanceOf(address(this));
        }
        toCoin.transferAndCall(bscBridge, sendToBinanceAmount, toBytes(binanceAddress));
        emit WithdrawToBinance(address(toCoin), binanceAddress, amountDatacoin, sendToBinanceAmount);
    }

    function _honeyswapPath(address toCoinXDai) internal view returns (address[] memory) {
        if(liquidityToken == address(0)){
            //no intermediate
            address[] memory path = new address[](2);
            path[0] = address(dataCoin);
            path[1] = toCoinXDai;
            return path;
        }
        //use intermediate liquidity token
        address[] memory path = new address[](3);
        path[0] = address(dataCoin);
        path[1] = liquidityToken;
        path[2] = toCoinXDai;
        return path;
    }
    
    // util functions
    function toBytes(address a) internal pure returns (bytes memory b) {
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
        // solhint-disable-next-line no-inline-assembly
        assembly {
            tempAddress := div(mload(add(_bytes, 0x20)), 0x1000000000000000000000000)
        }

        return tempAddress;
    }

    function getSigner(
        address recipient,
        bytes memory signature
    )
        public view
        returns (address)
    {
        require(signature.length == 65, "error_badSignatureLength");

        bytes32 r; bytes32 s; uint8 v;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        if (v < 27) {
            v += 27;
        }
        require(v == 27 || v == 28, "error_badSignatureVersion");

        bytes32 messageHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n104", recipient, address(this)));
        
        return ecrecover(messageHash, v, r, s);
    }

}