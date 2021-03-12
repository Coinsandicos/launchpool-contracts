// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import { FundRaisingGuild } from "./FundRaisingGuild.sol";

/// @title Fund raising platform facilitated by launch pool
/// @author BlockRocket.tech
/// @notice Fork of MasterChef.sol from SushiSwap
/// @dev Only the owner can add new pools
contract LaunchPoolFundRaisingWithVesting is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /// @dev Details about each user in a pool
    struct UserInfo {
        uint256 amount;     // How many tokens are staked in a pool
        uint256 pledgeFundingAmount;
        bool stakeWithdrawn; // Set to true if the staked amount is withdrawn after the deposit deadline. No more withdrawals permitted!!
        uint256 rewardDebt; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, once vesting has started in a pool (if they have deposited), the amount of reward tokens
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accRewardPerShare) - user.rewardDebt
        //
        // The amount can never change once the staking period has ended
    }

    /// @dev Info of each pool.
    struct PoolInfo {
        IERC20 rewardToken; // Address of the reward token contract.
        uint256 rewardPerBlock; // Number of reward tokens distributed per block for this pool
        uint256 stakingEndBlock;
        uint256 pledgeFundingEndBlock;
        uint256 lastRewardBlock; // Last block number that reward token distribution or vesting start block up to end block
        uint256 rewardEndBlock;
        uint256 accRewardPerShare; // Per LP token staked, how much reward token earned in pool that users will get
        uint256 maxRewardTokenAvailableForVesting;
        uint256 targetRaise;
        uint256 totalStaked;
        uint256 totalRaised;
        uint256 totalStakeThatHasFundedPledge;
        address payable fundRaisingRecipient;
        bool fundsClaimed;
    }

    /// @notice staking token is fixed for all pools
    IERC20 public stakingToken;

    /// @notice Container for holding all rewards
    FundRaisingGuild public rewardGuildBank;

    /// @notice List of pools that users can stake into
    PoolInfo[] public poolInfo;

    /// @notice Per pool, info of each user that stakes ERC20 tokens.
    /// @notice Pool ID => User Address => User Info
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    /// @notice The block number when rewards starts across all pools.
    //uint256 public startBlock;

    //event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    //event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    //event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    /// @param _stakingToken Address of the staking token for all pools
    constructor(IERC20 _stakingToken) public {
        require(address(_stakingToken) != address(0), "constructor: _stakingToken must not be zero address");

        rewardGuildBank = new FundRaisingGuild(address(this));

        //todo deploy event
    }

    /// @notice Returns the number of pools that have been added by the owner
    /// @return Number of pools
    function numberOfPools() external view returns (uint256) {
        return poolInfo.length;
    }

    /// @notice Create a new reward pool by whitelisting a new ERC20 token.
    /// @dev Can only be called by the contract owner
    function add(
        IERC20 _rewardToken,
        uint256 _stakingEndBlock,
        uint256 _pledgeFundingEndBlock,
        uint256 _targetRaise,
        address payable _fundRaisingRecipient,
        bool _withUpdate
    ) public onlyOwner {
        address rewardTokenAddress = address(_rewardToken);
        require(rewardTokenAddress != address(0), "add: _rewardToken is zero address");
        require(_stakingEndBlock < _pledgeFundingEndBlock, "add: staking end must be before funding end");
        require(_targetRaise > 0, "add: Invalid raise amount");
        require(_fundRaisingRecipient != address(0), "add: _fundRaisingRecipient is zero address");

        // todo: does mass update make sense here?
        if (_withUpdate) {
            massUpdatePools();
        }

        poolInfo.push(PoolInfo({
            rewardToken : _rewardToken,
            rewardPerBlock: 0,
            stakingEndBlock: _stakingEndBlock,
            pledgeFundingEndBlock: _pledgeFundingEndBlock,
            lastRewardBlock: 0,
            rewardEndBlock: 0,
            accRewardPerShare: 0,
            maxRewardTokenAvailableForVesting: 0,
            targetRaise: _targetRaise,
            totalStaked: 0,
            totalRaised: 0,
            totalStakeThatHasFundedPledge: 0,
            fundRaisingRecipient: _fundRaisingRecipient,
            fundsClaimed: false
        }));
    }

    // todo define what can be updated
//    /// @notice Update a pool's allocation point to increase or decrease its share of contract-level rewards
//    /// @notice Can also update the max amount that can be staked per user
//    /// @dev Can only be called by the owner
//    /// @param _pid ID of the pool being updated
//    /// @param _allocPoint New allocation point
//    /// @param _maxStakingAmountPerUser Maximum amount that a user can deposit into the far
//    /// @param _withUpdate Set to true if you want to update all pools before making this change - it will checkpoint those rewards
//    function set(uint256 _pid, uint256 _allocPoint, uint256 _maxStakingAmountPerUser, bool _withUpdate) public onlyOwner {
//        require(block.number < endBlock, "set: must be before end");
//        require(_pid < poolInfo.length, "set: invalid _pid");
//        require(_maxStakingAmountPerUser > 0, "set: _maxStakingAmountPerUser must be greater than zero");
//
//        if (_withUpdate) {
//            massUpdatePools();
//        }
//
//        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
//
//        poolInfo[_pid].allocPoint = _allocPoint;
//        poolInfo[_pid].maxStakingAmountPerUser = _maxStakingAmountPerUser;
//    }

    // step 1
    function pledge(uint256 _pid, uint256 _amount) external { //non reentrant?
        require(_pid < poolInfo.length, "pledge: Invalid PID");
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        require(_amount > 0, "pledge: No pledge specified");
        require(block.number <= pool.stakingEndBlock, "pledge: Staking no longer permitted");

        user.amount = user.amount.add(_amount);
        pool.totalStaked = pool.totalStaked.add(_amount);

        stakingToken.safeTransferFrom(address(msg.sender), address(this), _amount);

        // todo emit pledge
        //emit Deposit(msg.sender, _pid, _amount);
    }

    // pre-step 2 for staker
    function getPledgeFundingAmount(uint256 _pid) public view returns (uint256) {
        require(_pid < poolInfo.length, "getPledgeFundingAmount: Invalid PID");
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        uint256 targetRaiseForPool = pool.targetRaise.mul(1e18);
        uint256 raisePerShare = targetRaiseForPool.div(pool.totalStaked);

        return user.amount.mul(raisePerShare).div(1e18);
    }

    // step 2
    function fundPledge(uint256 _pid) external payable {
        require(_pid < poolInfo.length, "fundPledge: Invalid PID");
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        require(user.pledgeFundingAmount == 0, "fundPledge: Pledge has already been funded");
        require(block.number > pool.stakingEndBlock, "fundPledge: Staking is still taking place");
        require(block.number <= pool.pledgeFundingEndBlock, "fundPledge: Deadline has passed to fund your pledge");
        require(msg.value == getPledgeFundingAmount(_pid), "fundPledge: Required ETH amount not satisfied");

        pool.totalRaised = pool.totalRaised.add(msg.value);
        user.pledgeFundingAmount = msg.value;

        pool.totalStakeThatHasFundedPledge = pool.totalStakeThatHasFundedPledge.add(user.amount);

        // todo event
    }

    // pre-step 3 for client
    function getTotalRaised(uint256 _pid) external view returns (uint256) {
        return poolInfo[_pid].totalRaised;
    }

    // step 3
    function setupVestingRewards(uint256 _pid, uint256 _rewardAmount, uint256 _rewardEndBlock) external { //todo nonreentrant
        require(_pid < poolInfo.length, "setupVestingRewards: Invalid PID");
        require(_rewardEndBlock > block.number, "setupVestingRewards: end block in the past");

        PoolInfo storage pool = poolInfo[_pid];

        require(block.number > pool.pledgeFundingEndBlock, "setupVestingRewards: Stakers are still pledging");

        uint256 currentBlockNumber = block.number;
        uint256 vestingLength = _rewardEndBlock.sub(currentBlockNumber);

        pool.maxRewardTokenAvailableForVesting = _rewardAmount;
        pool.rewardPerBlock = _rewardAmount.div(vestingLength);
        pool.lastRewardBlock = currentBlockNumber;
        pool.rewardEndBlock = _rewardEndBlock;

        pool.rewardToken.transferFrom(msg.sender, address(rewardGuildBank), _rewardAmount);

        // todo emit event
    }

    function pendingRewards(uint256 _pid, address _user) external view returns (uint256) {
        require(_pid < poolInfo.length, "pendingRewards: invalid _pid");

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];

        // If they have staked but have not funded their pledge, they are not entitled to rewards
        if (user.pledgeFundingAmount == 0) {
            return 0;
        }

        uint256 accRewardPerShare = pool.accRewardPerShare;

        if (block.number > pool.lastRewardBlock && pool.rewardEndBlock != 0 && pool.totalStaked != 0) {
            uint256 maxEndBlock = block.number <= pool.rewardEndBlock ? block.number : pool.rewardEndBlock;
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, maxEndBlock);
            uint256 reward = multiplier.mul(pool.rewardPerBlock);
            accRewardPerShare = accRewardPerShare.add(reward.mul(1e18).div(pool.totalStakeThatHasFundedPledge));
        }

        return user.amount.mul(accRewardPerShare).div(1e18).sub(user.rewardDebt);
    }


    function massUpdatePools() public {
        for (uint256 pid = 0; pid < poolInfo.length; pid++) {
            updatePool(pid);
        }
    }


    function updatePool(uint256 _pid) public {
        require(_pid < poolInfo.length, "updatePool: invalid _pid");

        PoolInfo storage pool = poolInfo[_pid];
        if (pool.rewardEndBlock == 0) { // client has not sent rewards
            return;
        }

        //        uint256 erc20Supply = pool.erc20Token.balanceOf(address(this));
        //        if (erc20Supply == 0) {
        //            pool.lastRewardBlock = block.number;
        //            return;
        //        }

        uint256 maxEndBlock = block.number <= pool.rewardEndBlock ? block.number : pool.rewardEndBlock;
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, maxEndBlock);

        // No point in doing any more logic as the rewards have ended
        if (multiplier == 0) {
            return;
        }

        uint256 reward = multiplier.mul(pool.rewardPerBlock);

        pool.accRewardPerShare = pool.accRewardPerShare.add(reward.mul(1e18).div(pool.totalStakeThatHasFundedPledge));
        pool.lastRewardBlock = maxEndBlock;
    }

    function claimReward(uint256 _pid) public { //todo non reentrant
        updatePool(_pid);

        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.pledgeFundingAmount > 0, "claimReward: Nice try pal");

        PoolInfo storage pool = poolInfo[_pid];
        uint256 pending = user.amount.mul(pool.accRewardPerShare).div(1e18).sub(user.rewardDebt);
        if (pending > 0) {
            user.rewardDebt = user.amount.mul(pool.accRewardPerShare).div(1e18);
            safeRewardTransfer(pool.rewardToken, msg.sender, pending);
        }

        // todo emit event
    }

    // withdraw only permitted post `pledgeFundingEndBlock` and you can only take out full amount regardless of whether you have funded your pledge
    // functions like the old emergency withdraw as it does not concern itself with claiming rewards
    function withdraw(uint256 _pid) external {
        require(_pid < poolInfo.length, "withdraw: invalid _pid");

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        require(user.amount > 0, "withdraw: Nothing to see here");
        require(user.stakeWithdrawn == false, "withdraw: Stake already withdrawn");

        user.stakeWithdrawn = true;

        stakingToken.safeTransfer(address(msg.sender), user.amount);

        // todo event
        //emit Withdraw(msg.sender, _pid, _amount);
    }

    function claimFundRaising(uint256 _pid) external { // todo non reentrant
        require(_pid < poolInfo.length, "claimFundRaising: invalid _pid");
        PoolInfo storage pool = poolInfo[_pid];

        require(pool.fundsClaimed == false, "claimFundRaising: Already claimed funds");
        require(msg.sender == pool.fundRaisingRecipient, "claimFundRaising: Only fundraising recipient");

        pool.fundsClaimed = true;
        pool.fundRaisingRecipient.call{value: pool.totalRaised}("");

        // todo event
    }

    ////////////
    // Private /
    ////////////

    /// @dev Safe reward transfer function, just in case if rounding error causes pool to not have enough rewards.

    function safeRewardTransfer(IERC20 _rewardToken, address _to, uint256 _amount) private {
        uint256 bal = rewardGuildBank.tokenBalance(_rewardToken);
        if (_amount > bal) {
            rewardGuildBank.withdrawTo(_rewardToken, _to, bal);
        } else {
            rewardGuildBank.withdrawTo(_rewardToken, _to, _amount);
        }
    }

    /// @notice Return reward multiplier over the given _from to _to block.
    /// @param _from Block number
    /// @param _to Block number
    /// @return Number of blocks that have passed
    function getMultiplier(uint256 _from, uint256 _to) private view returns (uint256) {
        return _to.sub(_from);
    }
}
