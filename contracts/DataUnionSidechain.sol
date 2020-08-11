pragma solidity ^0.6.0;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Ownable.sol";

interface ERC677 is IERC20 {
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

contract DataUnionSidechain is Ownable {
    using SafeMath for uint256;

    //used to describe members and join part agents
    enum ActiveStatus {None, Active, Inactive, Blocked}

    //emitted by joins/parts
    event MemberJoined(address indexed);
    event MemberParted(address indexed);
    event JoinPartAgentAdded(address indexed);
    event JoinPartAgentRemoved(address indexed);

    event AdminFeeChanged(uint256 adminFee);

    //emitted when revenue received
    event RevenueReceived(uint256 amount);
    event MemberEarn(uint256 per_member_earn, uint256 active_members);
    event AdminFeeCharged(uint256 amount);

    //emitted by withdrawal
    event EarningsWithdrawn(address indexed member, uint256 amount);
    event AdminFeesWithdrawn(address indexed admin, uint256 amount);

    //in-contract transfers
    event TransferWithinContract(address indexed from, address indexed to, uint amount);
    event TransferToAddressInContract(address indexed from, address indexed to, uint amount);


    struct MemberInfo {
        ActiveStatus status;
        uint256 earnings_before_last_join;
        uint256 lme_at_join;
        uint256 withdrawnEarnings;
    }

    ERC677 public token;
    uint256 public adminFeeFraction;
    address public token_mediator;
    address public mainchain_DU;

/*
    totalEarnings includes:
         member earnings (ie revenue - admin fees)
         tokens held for members via transferToMemberInContract()

    totalRevenue = totalEarnings + totalAdminFees;
*/
    uint256 public totalEarnings;
    uint256 public totalEarningsWithdrawn;

    //only adminFee
    uint256 public totalAdminFees;
    uint256 public totalAdminFeesWithdrawn;

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
        uint256 adminFeeFraction_,
        address[] memory agents,
        address _token_mediator,
        address _mainchain_DU
    ) public {
        require(!isInitialized(),"init_once");
        //set owner at the end. caller needs admin to initialize()
        owner = msg.sender;
        token = ERC677(token_address);
        setAdminFee(adminFeeFraction_);
        addJoinPartAgents(agents);
        token_mediator = _token_mediator;
        mainchain_DU = _mainchain_DU;
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

    /**
     * Admin fee as a fraction of revenue.
     * Smart contract doesn't use it, it's here just for storing purposes.
     * @param newAdminFee fixed-point decimal in the same way as ether: 50% === 0.5 ether === "500000000000000000"
     */
    function setAdminFee(uint256 newAdminFee) public onlyOwner {
        require(newAdminFee <= 1 ether, "error_adminFee");
        adminFeeFraction = newAdminFee;
        emit AdminFeeChanged(adminFeeFraction);
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

    function addRevenue() public returns (uint256) {
        // a.sub(b) errors if b > a
        uint256 amount = token.balanceOf(address(this)).sub(
            totalWithdrawable()
        );
        if (amount == 0) return 0;
        uint256 adminFee = amount.mul(adminFeeFraction).div(10**18);
        uint256 memberEarnings = amount.sub(adminFee);
        uint256 per_member_earn = memberEarnings.div(active_members);
        lifetime_member_earnings = lifetime_member_earnings.add(
            per_member_earn
        );
        totalEarnings = totalEarnings.add(memberEarnings);
        totalAdminFees = totalAdminFees.add(adminFee);

        emit RevenueReceived(amount);
        emit MemberEarn(per_member_earn, active_members);
        emit AdminFeeCharged(adminFee);
        return amount;
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

    function totalRevenue() public view returns (uint256) {
        return totalEarnings.add(totalAdminFees);
    }

    function totalWithdrawable() public view returns (uint256) {
        return
            totalRevenue().sub(totalEarningsWithdrawn).sub(
                totalAdminFeesWithdrawn
            );
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
     * @param recipient
     * @param amount
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
            withdrawn.add(withdraw(members[i], sendToMainnet));
        }
        return withdrawn;
    }

    function withdraw(address member, bool sendToMainnet)
        public
        returns (uint256)
    {
        uint256 withdrawable = getWithdrawableEarnings(member);
        if (withdrawable == 0) return 0;
        MemberInfo storage info = memberData[member];
        info.withdrawnEarnings = info.withdrawnEarnings.add(withdrawable);
        totalEarningsWithdrawn = totalEarningsWithdrawn.add(withdrawable);
        if (sendToMainnet)
            require(
                token.transferAndCall(
                    token_mediator,
                    withdrawable,
                    toBytes(member)
                ),
                "transfer_failed"
            );
        else require(token.transfer(member, withdrawable), "transfer_failed");
        emit EarningsWithdrawn(member, withdrawable);
        return withdrawable;
    }

    function withdrawAdminFees(bool sendToMainnet) public returns (uint256) {
        uint256 withdrawable = totalAdminFees.sub(totalAdminFeesWithdrawn);
        if (withdrawable == 0) return 0;
        totalAdminFeesWithdrawn = totalAdminFeesWithdrawn.add(withdrawable);
        if (sendToMainnet)
            require(
                token.transferAndCall(
                    token_mediator,
                    withdrawable,
                    toBytes(owner)
                ),
                "transfer_failed"
            );
        else require(token.transfer(owner, withdrawable), "transfer_failed");
        emit AdminFeesWithdrawn(owner, withdrawable);
        return withdrawable;
    }
}
