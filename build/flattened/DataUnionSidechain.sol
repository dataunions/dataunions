
// File: openzeppelin-solidity/contracts/math/SafeMath.sol

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

/**
 * @dev Wrappers over Solidity's arithmetic operations with added overflow
 * checks.
 *
 * Arithmetic operations in Solidity wrap on overflow. This can easily result
 * in bugs, because programmers usually assume that an overflow raises an
 * error, which is the standard behavior in high level programming languages.
 * `SafeMath` restores this intuition by reverting the transaction when an
 * operation overflows.
 *
 * Using this library instead of the unchecked operations eliminates an entire
 * class of bugs, so it's recommended to use it always.
 */
library SafeMath {
    /**
     * @dev Returns the addition of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     *
     * - Addition cannot overflow.
     */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     *
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting with custom message on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     *
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    /**
     * @dev Returns the multiplication of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `*` operator.
     *
     * Requirements:
     *
     * - Multiplication cannot overflow.
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts with custom message on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b > 0, errorMessage);
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, "SafeMath: modulo by zero");
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts with custom message when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }
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

// File: contracts/IERC677.sol

pragma solidity ^0.6.0;


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

// File: contracts/Ownable.sol

pragma solidity ^0.6.0;
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

// File: contracts/DataUnionSidechain.sol

pragma solidity ^0.6.0;





contract DataUnionSidechain is Ownable {
    using SafeMath for uint256;

    //used to describe members and join part agents
    enum ActiveStatus {None, Active, Inactive, Blocked}

    //emitted by joins/parts
    event MemberJoined(address indexed);
    event MemberParted(address indexed);
    event JoinPartAgentAdded(address indexed);
    event JoinPartAgentRemoved(address indexed);


    //emitted when revenue received
    event EarningsReceived(uint256 amount);
    event MemberEarn(uint256 per_member_earn, uint256 active_members);

    //emitted by withdrawal
    event EarningsWithdrawn(address indexed member, uint256 amount);

    //in-contract transfers
    event TransferWithinContract(address indexed from, address indexed to, uint amount);
    event TransferToAddressInContract(address indexed from, address indexed to, uint amount);


    struct MemberInfo {
        ActiveStatus status;
        uint256 earnings_before_last_join;
        uint256 lme_at_join;
        uint256 withdrawnEarnings;
    }

    IERC677 public token;
    address public token_mediator;
    address public mainchain_DU;

    uint256 public totalEarnings;
    uint256 public totalEarningsWithdrawn;

    uint256 public active_members;
    uint256 public lifetime_member_earnings;

    uint256 public join_part_agent_count;
    mapping(address => MemberInfo) public memberData;
    mapping(address => ActiveStatus) public joinPartAgents;

    modifier onlyJoinPartAgent() {
        require(
            joinPartAgents[msg.sender] == ActiveStatus.Active,
            "onlyJoinPartAgent"
        );
        _;
    }

    //owner set by initialize()
    constructor() public Ownable(address(0)) {}

    function initialize(
        address _owner,
        address token_address,
        address[] memory agents,
        address _token_mediator,
        address _mainchain_DU
    ) public {
        require(!isInitialized(), "init_once");
        //during setup, msg.sender is admin
        owner = msg.sender;
        token = IERC677(token_address);
        addJoinPartAgents(agents);
        token_mediator = _token_mediator;
        mainchain_DU = _mainchain_DU;
        //transfer to real admin
        owner = _owner;
    }

    function isInitialized() public view returns (bool){
        return address(token) != address(0);
    }

    function toBytes(address a) public pure returns (bytes memory b) {
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



    function addJoinPartAgents(address[] memory agents) public onlyOwner {
        for (uint256 i = 0; i < agents.length; i++) {
            addJoinPartAgent(agents[i]);
        }
    }

    function addJoinPartAgent(address agent) public onlyOwner {
        require(joinPartAgents[agent] != ActiveStatus.Active, "jpagent_active");
        joinPartAgents[agent] = ActiveStatus.Active;
        emit JoinPartAgentAdded(agent);
        join_part_agent_count = join_part_agent_count.add(1);
    }

    function removeJoinPartAgent(address agent) public onlyOwner {
        require(
            joinPartAgents[agent] == ActiveStatus.Active,
            "jpagent_not_active"
        );
        joinPartAgents[agent] = ActiveStatus.Inactive;
        emit JoinPartAgentRemoved(agent);
        join_part_agent_count = join_part_agent_count.sub(1);
    }

    function getEarnings(address member) public view returns (uint256) {
        MemberInfo storage info = memberData[member];
        require(info.status != ActiveStatus.None, "member_unknown");
        return
            info.earnings_before_last_join +
            (
                info.status == ActiveStatus.Active
                    ? lifetime_member_earnings.sub(info.lme_at_join)
                    : 0
            );
    }

    function getWithdrawn(address member) public view returns (uint256) {
        MemberInfo storage info = memberData[member];
        require(info.status != ActiveStatus.None, "member_unknown");
        return info.withdrawnEarnings;
    }

    function getWithdrawableEarnings(address member)
        public
        view
        returns (uint256)
    {
        return getEarnings(member).sub(getWithdrawn(member));
    }

    /**
        process unaccounted tokens
    */

    function addRevenue() public returns (uint256) {
        uint256 balance = token.balanceOf(address(this));
        uint256 memberEarnings = balance.sub(totalWithdrawable()); // a.sub(b) errors if b > a
        if (memberEarnings == 0) return 0;
        uint256 per_member_earn = memberEarnings.div(active_members);
        lifetime_member_earnings = lifetime_member_earnings.add(
            per_member_earn
        );
        totalEarnings = totalEarnings.add(memberEarnings);

        emit EarningsReceived(memberEarnings);
        emit MemberEarn(per_member_earn, active_members);
        return memberEarnings;
    }

    function addMember(address member) public onlyJoinPartAgent {
        MemberInfo storage info = memberData[member];
        require(info.status != ActiveStatus.Active, "member_already_active");
        info.status = ActiveStatus.Active;
        info.lme_at_join = lifetime_member_earnings;
        active_members = active_members.add(1);
        emit MemberJoined(member);
    }

    function partMember(address member) public {
        require(
            msg.sender == member ||
                joinPartAgents[msg.sender] == ActiveStatus.Active,
            "access_denied"
        );
        MemberInfo storage info = memberData[member];
        require(info.status == ActiveStatus.Active, "member_not_active");
        info.earnings_before_last_join = getEarnings(member);
        info.status = ActiveStatus.Inactive;
        active_members = active_members.sub(1);
        emit MemberParted(member);
    }

    function addMembers(address[] memory members) public onlyJoinPartAgent {
        for (uint256 i = 0; i < members.length; i++) {
            addMember(members[i]);
        }
    }

    //access checked in partMember
    function partMembers(address[] memory members) public {
        for (uint256 i = 0; i < members.length; i++) {
            partMember(members[i]);
        }
    }


    function totalWithdrawable() public view returns (uint256) {
        return
            totalEarnings.sub(totalEarningsWithdrawn);
    }

    /*
        transfer tokens from outside contract, add to recipient's in-contract balance
    */

    function transferToMemberInContract(address recipient, uint amount) public {
        uint bal_before = token.balanceOf(address(this));
        require(token.transferFrom(msg.sender, address(this), amount), "transfer_failed");
        uint bal_after = token.balanceOf(address(this));
        require(bal_after.sub(bal_before) >= amount, "transfer_failed");
        _increaseBalance(recipient,  amount);
        totalEarnings = totalEarnings.add(amount);
        emit TransferToAddressInContract(msg.sender, recipient,  amount);
    }

    /**
     * Transfer tokens from sender's in-contract balance to recipient's in-contract balance
     * This is done by "withdrawing" sender's earnings and crediting them to recipient's unwithdrawn earnings,
     *   so withdrawnEarnings never decreases for anyone (within this function)
     * @param recipient whose withdrawable earnings will increase
     * @param amount how much withdrawable earnings is transferred
     */
    function transferWithinContract(address recipient, uint amount) public {
        require(getWithdrawableEarnings(msg.sender) >= amount, "insufficient_balance");
        MemberInfo storage info = memberData[msg.sender];
        info.withdrawnEarnings = info.withdrawnEarnings.add(amount);
        _increaseBalance(recipient,  amount);
        emit TransferWithinContract(msg.sender, recipient, amount);
     }

    function _increaseBalance(address member, uint amount) internal {
        MemberInfo storage info = memberData[member];
        info.earnings_before_last_join = info.earnings_before_last_join.add(amount);
    }

    function withdrawMembers(address[] memory members, bool sendToMainnet)
        public
        returns (uint256)
    {
        uint256 withdrawn = 0;
        for (uint256 i = 0; i < members.length; i++) {
            withdrawn.add(withdrawAll(members[i], sendToMainnet));
        }
        return withdrawn;
    }
    
    function withdrawAll(address member, bool sendToMainnet)
        public
        returns (uint256)
    {
        return withdraw(member, getWithdrawableEarnings(member), sendToMainnet);
    }

    function withdraw(address member, uint amount, bool sendToMainnet)
        public
        returns (uint256)
    {
        require(msg.sender == member || msg.sender == owner, "permission_denied");
        _withdrawTo(member, member, amount, sendToMainnet);
    }

    function withdrawAllTo(address to, bool sendToMainnet)
        public
        returns (uint256) 
    {
        withdrawTo(to, getWithdrawableEarnings(msg.sender), sendToMainnet);
    }

    function withdrawTo(address to, uint amount, bool sendToMainnet)
        public
        returns (uint256)
    {
        _withdrawTo(msg.sender, to, amount, sendToMainnet);
    }

    /*
        internal helper method. does NOT check access. 
    */

    function _withdrawTo(address from, address to, uint amount, bool sendToMainnet)
        internal
        returns (uint256)
    {
        if (amount == 0) return 0;
        require(amount <= getWithdrawableEarnings(from), "insufficient_funds");
        MemberInfo storage info = memberData[from];
        info.withdrawnEarnings = info.withdrawnEarnings.add(amount);
        totalEarningsWithdrawn = totalEarningsWithdrawn.add(amount);
        if (sendToMainnet)
            require(
                token.transferAndCall(
                    token_mediator,
                    amount,
                    toBytes(to)
                ),
                "transfer_failed"
            );
        else require(token.transfer(to, amount), "transfer_failed");
        emit EarningsWithdrawn(from, amount);
        return amount;
    }


    /**
     * Check signature from a member authorizing withdrawing its earnings to another account.
     * Throws if the signature is badly formatted or doesn't match the given signer and amount.
     * Signature has parts the act as replay protection:
     * 1) `address(this)`: signature can't be used for other contracts;
     * 2) `withdrawn[signer]`: signature only works once (for unspecified amount), and can be "cancelled" by sending a withdraw tx.
     * Generated in Javascript with: `web3.eth.accounts.sign(recipientAddress + amount.toString(16, 64) + contractAddress.slice(2) + withdrawnTokens.toString(16, 64), signerPrivateKey)`,
     * or for unlimited amount: `web3.eth.accounts.sign(recipientAddress + "0".repeat(64) + contractAddress.slice(2) + withdrawnTokens.toString(16, 64), signerPrivateKey)`.
     * @param signer whose earnings are being withdrawn
     * @param recipient of the tokens
     * @param amount how much is authorized for withdraw, or zero for unlimited (withdrawAll)
     * @param signature byte array from `web3.eth.accounts.sign`
     * @return isValid true iff signer of the authorization (member whose earnings are going to be withdrawn) matches the signature
     */
    function signatureIsValid(address signer, address recipient, uint amount, bytes memory signature) public view returns (bool isValid) {
        require(signature.length == 65, "error_badSignatureLength");

        bytes32 r; bytes32 s; uint8 v;
        assembly {      // solium-disable-line security/no-inline-assembly
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        if (v < 27) {
            v += 27;
        }
        require(v == 27 || v == 28, "error_badSignatureVersion");

        // When changing the message, remember to double-check that message length is correct!
        bytes32 messageHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n104", recipient, amount, address(this), getWithdrawn(signer)));
        address calculatedSigner = ecrecover(messageHash, v, r, s);

        return calculatedSigner == signer;
    }
    
    function withdrawAllToSigned(address from_signer, address to, bool sendToMainnet, bytes memory signature) public returns (uint withdrawn){
        return withdrawToSigned(from_signer, to, getWithdrawableEarnings(from_signer), sendToMainnet, signature);
    }

    function withdrawToSigned(address from_signer, address to, uint amount, bool sendToMainnet, bytes memory signature) public returns (uint withdrawn){
        require(signatureIsValid(from_signer, to, amount, signature), "error_badSignature");
        return _withdrawTo(from_signer, to, amount, sendToMainnet);
    }
}
