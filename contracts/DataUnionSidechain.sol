pragma solidity ^0.6.0;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "./IERC677.sol";
import "./Ownable.sol"; // TODO: switch to "openzeppelin-solidity/contracts/access/Ownable.sol";

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
    event RevenueReceived(uint256 amount);
    event NewEarnings(uint256 earningsPerMember, uint256 activeMemberCount);

    //emitted by withdrawal
    event EarningsWithdrawn(address indexed member, uint256 amount);

    //in-contract transfers
    event TransferWithinContract(address indexed from, address indexed to, uint amount);
    event TransferToAddressInContract(address indexed from, address indexed to, uint amount);

    //new member eth
    event UpdateNewMemberEth(uint value);
    event NewMemberEthSent(uint amountWei);

    struct MemberInfo {
        ActiveStatus status;
        uint256 earningsBeforeLastJoin;
        uint256 lmeAtJoin;
        uint256 withdrawnEarnings;
    }

    IERC677 public token;
    address public tokenMediator;
    address public dataUnionMainnet;

    uint256 public totalEarnings;
    uint256 public totalEarningsWithdrawn;

    uint256 public activeMemberCount;
    uint256 public lifetimeMemberEarnings;

    uint256 public joinPartAgentCount;

    uint256 public newMemberEth;

    mapping(address => MemberInfo) public memberData;
    mapping(address => ActiveStatus) public joinPartAgents;

    modifier onlyJoinPartAgent() {
        require(joinPartAgents[msg.sender] == ActiveStatus.Active, "error_onlyJoinPartAgent");
        _;
    }

    // owner will be set by initialize()
    constructor() public Ownable(address(0)) {}

    //contract is payable
    receive() external payable {}

    function initialize(
        address initialOwner,
        address tokenAddress,
        address[] memory initialJoinPartAgents,
        address tokenMediatorAddress,
        address mainnetDataUnionAddress,
        uint256 defaultNewMemberEth
    ) public {
        require(!isInitialized(), "error_alreadyInitialized");
        owner = msg.sender; // set real owner at the end. During initialize, addJoinPartAgents can be called by owner only
        token = IERC677(tokenAddress);
        addJoinPartAgents(initialJoinPartAgents);
        tokenMediator = tokenMediatorAddress;
        dataUnionMainnet = mainnetDataUnionAddress;
        setNewMemberEth(defaultNewMemberEth);
        owner = initialOwner;
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

    function setNewMemberEth(uint val) public onlyOwner {
        if(val == newMemberEth) return;
        newMemberEth = val;
        emit UpdateNewMemberEth(val);
    }

    function addJoinPartAgents(address[] memory agents) public onlyOwner {
        for (uint256 i = 0; i < agents.length; i++) {
            addJoinPartAgent(agents[i]);
        }
    }

    function addJoinPartAgent(address agent) public onlyOwner {
        require(joinPartAgents[agent] != ActiveStatus.Active, "error_alreadyActiveAgent");
        joinPartAgents[agent] = ActiveStatus.Active;
        emit JoinPartAgentAdded(agent);
        joinPartAgentCount = joinPartAgentCount.add(1);
    }

    function removeJoinPartAgent(address agent) public onlyOwner {
        require(joinPartAgents[agent] == ActiveStatus.Active, "error_notActiveAgent");
        joinPartAgents[agent] = ActiveStatus.Inactive;
        emit JoinPartAgentRemoved(agent);
        joinPartAgentCount = joinPartAgentCount.sub(1);
    }

    function getEarnings(address member) public view returns (uint256) {
        MemberInfo storage info = memberData[member];
        require(info.status != ActiveStatus.None, "error_notMember");
        return
            info.earningsBeforeLastJoin +
            (
                info.status == ActiveStatus.Active
                    ? lifetimeMemberEarnings.sub(info.lmeAtJoin)
                    : 0
            );
    }

    function getWithdrawn(address member) public view returns (uint256) {
        MemberInfo storage info = memberData[member];
        require(info.status != ActiveStatus.None, "error_notMember");
        return info.withdrawnEarnings;
    }

    function getWithdrawableEarnings(address member) public view returns (uint256) {
        return getEarnings(member).sub(getWithdrawn(member));
    }

    /**
     * Process unaccounted tokens that have been sent previously
     * Called by AMB (see DataUnionMainnet:sendTokensToBridge)
     */
    function addRevenue() public returns (uint256) {
        uint256 balance = token.balanceOf(address(this));
        uint256 revenue = balance.sub(totalWithdrawable()); // a.sub(b) errors if b > a
        if (revenue == 0) return 0;
        uint256 earningsPerMember = revenue.div(activeMemberCount);
        lifetimeMemberEarnings = lifetimeMemberEarnings.add(earningsPerMember);
        totalEarnings = totalEarnings.add(revenue);
        emit RevenueReceived(revenue);
        emit NewEarnings(earningsPerMember, activeMemberCount);
        return revenue;
    }

    function addMember(address payable member) public onlyJoinPartAgent {
        MemberInfo storage info = memberData[member];
        require(info.status != ActiveStatus.Active, "error_alreadyMember");
        bool sendEth = info.status == ActiveStatus.None && newMemberEth > 0 && address(this).balance >= newMemberEth;
        info.status = ActiveStatus.Active;
        info.lmeAtJoin = lifetimeMemberEarnings;
        activeMemberCount = activeMemberCount.add(1);
        emit MemberJoined(member);

        // give new members ETH. continue even if transfer fails
        if (sendEth) {
            if (member.send(newMemberEth)) {
                NewMemberEthSent(newMemberEth);
            }
        }
    }

    function partMember(address member) public {
        require(msg.sender == member || joinPartAgents[msg.sender] == ActiveStatus.Active, "error_notPermitted");
        MemberInfo storage info = memberData[member];
        require(info.status == ActiveStatus.Active, "error_notActiveMember");
        info.earningsBeforeLastJoin = getEarnings(member);
        info.status = ActiveStatus.Inactive;
        activeMemberCount = activeMemberCount.sub(1);
        emit MemberParted(member);
    }

    function addMembers(address payable[] memory members) public onlyJoinPartAgent {
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
        info.earningsBeforeLastJoin = info.earningsBeforeLastJoin.add(amount);
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
                    tokenMediator,
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

    function withdrawAllToSigned(address fromSigner, address to, bool sendToMainnet, bytes memory signature) public returns (uint withdrawn){
        return withdrawToSigned(fromSigner, to, getWithdrawableEarnings(fromSigner), sendToMainnet, signature);
    }

    function withdrawToSigned(address fromSigner, address to, uint amount, bool sendToMainnet, bytes memory signature) public returns (uint withdrawn){
        require(signatureIsValid(fromSigner, to, amount, signature), "error_badSignature");
        return _withdrawTo(fromSigner, to, amount, sendToMainnet);
    }
}
