// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./LaunchPoolToken.sol";

/// @title Staking contract for farming LPT rewards in return for staking a number of whitelisted LP tokens
/// @author BlockRocket.tech
/// @notice Based on MasterChef.sol from SushiSwap
/// @dev Only the owner can add new farms
contract LaunchPoolStaking is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /// @dev Details about each user in a pool
    struct UserInfo {
        uint256 amount;     // How many LP tokens the user has provided to a pool
        uint256 rewardDebt; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of LPTs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accLptPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accLptPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    /// @dev Info of each farm.
    struct FarmInfo {
        IERC20 lpToken;           // Address of LP token contract.
        uint256 allocPoint;       // How many allocation points assigned to this pool. Essentially percentage of total LPT
        uint256 lastRewardBlock;  // Last block number that LPT distribution has occurred up to endBlock.
        uint256 accLptPerShare; // Per LP token staked, how much LPT earned in pool that users will get
        uint256 maxStakingAmountPerUser; // Max. amount of tokens that can be staked per account
    }

    /// @notice The reward token - $LPT
    LaunchPoolToken public lpt;

    /// @notice Number of LPT tokens distributed per block, across all pools.
    uint256 public lptPerBlock;

    /// @notice The total amount of reward token available for farming across all pools between start and end block.
    uint256 public maxLPTAvailableForFarming;

    /// @notice List of farms that users can stake into
    FarmInfo[] public farmInfo;

    /// @notice Per pool, info of each user that stakes LP tokens.
    /// @notice Pool ID => User Address => User Info
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    /// @notice Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint;

    /// @notice The block number when LPT rewards starts across all pools.
    uint256 public startBlock;

    /// @notice The block number when rewards ends.
    uint256 public endBlock;

    /// @notice Tracks LP tokens added by owner
    mapping(address => bool) isLPTokenWhitelisted;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    /// @param _lpt Address of the LPT reward token
    /// @param _maxLPTAvailableForFarming Maximum number of LPT that will be distributed between the start and end of farming
    /// @param _startBlock Block number when farming will begin for all pools
    /// @param _endBlock Block number when farming will end for all pools
    constructor(
        LaunchPoolToken _lpt,
        uint256 _maxLPTAvailableForFarming,
        uint256 _startBlock,
        uint256 _endBlock
    ) public {
        require(address(_lpt) != address(0), "constructor: _lpt must not be zero address");
        require(_endBlock > _startBlock, "constructor: end must be after start");
        require(_maxLPTAvailableForFarming > 0, "constructor: _maxLPTAvailableForFarming must be greater than zero");

        lpt = _lpt;
        maxLPTAvailableForFarming = _maxLPTAvailableForFarming;
        startBlock = _startBlock;
        endBlock = _endBlock;

        uint256 numberOfBlocksForFarming = endBlock.sub(startBlock);
        lptPerBlock = maxLPTAvailableForFarming.div(numberOfBlocksForFarming);
    }

    /// @notice Returns the number of farms that have been added by the owner
    /// @return Number of farms
    function numOfFarms() external view returns (uint256) {
        return farmInfo.length;
    }

    /// @notice Create a new LPT farm by whitelisting a new LP token.
    /// @dev Can only be called by the contract owner
    /// @param _allocPoint Governs what percentage of the total LPT rewards this farm and other farms will get
    /// @param _lpToken Address of the staking token being whitelisted
    /// @param _maxStakingAmountPerUser For this farm, maximum amount per user that can be staked
    /// @param _withUpdate Set to true for updating all farms before adding this one
    function add(uint256 _allocPoint, IERC20 _lpToken, uint256 _maxStakingAmountPerUser, bool _withUpdate) public onlyOwner {
        require(block.number < endBlock, "add: must be before end");

        address lpTokenAddress = address(_lpToken);
        require(lpTokenAddress != address(0), "add: _lpToken must not be zero address");
        require(isLPTokenWhitelisted[lpTokenAddress] == false, "add: already whitelisted");

        if (_withUpdate) {
            massUpdatePools();
        }

        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        farmInfo.push(FarmInfo({
            lpToken : _lpToken,
            allocPoint : _allocPoint,
            lastRewardBlock : lastRewardBlock,
            accLptPerShare : 0,
            maxStakingAmountPerUser: _maxStakingAmountPerUser
        }));

        isLPTokenWhitelisted[lpTokenAddress] = true;
    }

    /// @notice Update a farm's allocation point to increase or decrease its share of contract-level rewards
    /// @notice Can also update the max amount that can be staked per user
    /// @dev Can only be called by the owner
    /// @param _pid ID of the farm / pool being updated
    /// @param _allocPoint New allocation point
    /// @param _maxStakingAmountPerUser Maximum amount that a user can deposit into the far
    /// @param _withUpdate Set to true if you want to update all pools before making this change - it will checkpoint those rewards
    function set(uint256 _pid, uint256 _allocPoint, uint256 _maxStakingAmountPerUser, bool _withUpdate) public onlyOwner {
        require(block.number < endBlock, "set: must be before end");
        require(_pid < farmInfo.length, "set: invalid _pid");

        if (_withUpdate) {
            massUpdatePools();
        }

        totalAllocPoint = totalAllocPoint.sub(farmInfo[_pid].allocPoint).add(_allocPoint);

        farmInfo[_pid].allocPoint = _allocPoint;
        farmInfo[_pid].maxStakingAmountPerUser = _maxStakingAmountPerUser;
    }

    /// @notice View function to see pending and unclaimed LPTs for a given user
    /// @param _pid ID of the farm where a user has a stake
    /// @param _user Account being queried
    /// @return Amount of LPT tokens due to a user
    function pendingLpt(uint256 _pid, address _user) external view returns (uint256) {
        require(_pid < farmInfo.length, "pendingLpt: invalid _pid");

        FarmInfo storage farm = farmInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];

        uint256 accLptPerShare = farm.accLptPerShare;
        uint256 lpSupply = farm.lpToken.balanceOf(address(this));

        if (block.number > farm.lastRewardBlock && lpSupply != 0) {
            uint256 maxEndBlock = block.number <= endBlock ? block.number : endBlock;
            uint256 multiplier = getMultiplier(farm.lastRewardBlock, maxEndBlock);
            uint256 lptReward = multiplier.mul(lptPerBlock).mul(farm.allocPoint).div(totalAllocPoint);
            accLptPerShare = accLptPerShare.add(lptReward.mul(1e18).div(lpSupply));
        }

        return user.amount.mul(accLptPerShare).div(1e18).sub(user.rewardDebt);
    }

    /// @notice Cycles through the farms to update all of the rewards accrued
    function massUpdatePools() public {
        uint256 length = farmInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    /// @notice Updates a specific farm to track all of the rewards accrued up to the TX block
    /// @param _pid ID of the farm
    function updatePool(uint256 _pid) public {
        require(_pid < farmInfo.length, "updatePool: invalid _pid");

        FarmInfo storage farm = farmInfo[_pid];
        if (block.number <= farm.lastRewardBlock) {
            return;
        }

        uint256 lpSupply = farm.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            farm.lastRewardBlock = block.number;
            return;
        }

        uint256 maxEndBlock = block.number <= endBlock ? block.number : endBlock;
        uint256 multiplier = getMultiplier(farm.lastRewardBlock, maxEndBlock);

        // No point in doing any more logic as the rewards have ended
        if (multiplier == 0) {
            return;
        }

        uint256 lptReward = multiplier.mul(lptPerBlock).mul(farm.allocPoint).div(totalAllocPoint);

        farm.accLptPerShare = farm.accLptPerShare.add(lptReward.mul(1e18).div(lpSupply));
        farm.lastRewardBlock = maxEndBlock;
    }

    /// @notice Where any user can stake their LP tokens into a farm in order to farm $LPT
    /// @param _pid ID of the farm
    /// @param _amount Amount of LP being staked
    function deposit(uint256 _pid, uint256 _amount) external {
        FarmInfo storage farm = farmInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        require(user.amount.add(_amount) <= farm.maxStakingAmountPerUser, "deposit: can not exceed farm token cap");

        updatePool(_pid);

        if (user.amount > 0) {
            uint256 pending = user.amount.mul(farm.accLptPerShare).div(1e18).sub(user.rewardDebt);
            if (pending > 0) {
                safeLptTransfer(msg.sender, pending);
            }
        }

        if (_amount > 0) {
            farm.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount.add(_amount);
        }

        user.rewardDebt = user.amount.mul(farm.accLptPerShare).div(1e18);
        emit Deposit(msg.sender, _pid, _amount);
    }

    /// @notice Allows a user to withdraw any LP tokens staked in a farm
    /// @dev Partial withdrawals permitted
    /// @param _pid Farm ID
    /// @param _amount Being withdrawn
    function withdraw(uint256 _pid, uint256 _amount) external {
        FarmInfo storage farm = farmInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        require(user.amount >= _amount, "withdraw: _amount not good");

        updatePool(_pid);

        uint256 pending = user.amount.mul(farm.accLptPerShare).div(1e18).sub(user.rewardDebt);
        if (pending > 0) {
            safeLptTransfer(msg.sender, pending);
        }

        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            farm.lpToken.safeTransfer(address(msg.sender), _amount);
        }

        user.rewardDebt = user.amount.mul(farm.accLptPerShare).div(1e18);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    /// @notice Emergency only. Should the rewards issuance mechanism fail, people can still withdraw their stake
    /// @param _pid Farm ID
    function emergencyWithdraw(uint256 _pid) external {
        require(_pid < farmInfo.length, "updatePool: invalid _pid");

        FarmInfo storage farm = farmInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        uint256 amount = user.amount;
        user.amount = 0;
        user.rewardDebt = 0;

        farm.lpToken.safeTransfer(address(msg.sender), amount);
        emit EmergencyWithdraw(msg.sender, _pid, amount);
    }

    ////////////
    // Private /
    ////////////

    /// @dev Safe LPT transfer function, just in case if rounding error causes farm to not have enough LPTs.
    /// @param _to Who to send LPT into
    /// @param _amount of LPT to send
    function safeLptTransfer(address _to, uint256 _amount) private {
        uint256 lptBal = lpt.balanceOf(address(this));
        if (_amount > lptBal) {
            lpt.transfer(_to, lptBal);
        } else {
            lpt.transfer(_to, _amount);
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
