pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./LaunchPoolToken.sol";

contract LaunchPoolStaking is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Info of each user.
    struct UserInfo {
        uint256 amount;     // How many LP tokens the user has provided.
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

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;           // Address of LP token contract.
        uint256 allocPoint;       // How many allocation points assigned to this pool. LPTs to distribute per block.
        uint256 lastRewardBlock;  // Last block number that LPTs distribution occurs.
        uint256 accLptPerShare; // Accumulated LPTs per share, times 1e18. See below.
        uint256 tokenCap; // Max. amount of tokens per account
    }

    // The $LPT TOKEN!
    LaunchPoolToken public lpt;
    // LPT tokens created per block.
    uint256 public lptPerBlock;
    /// @notice The total max amount of reward token to farm.
    uint256 public rewardLimit;
    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when LPT rewards starts.
    uint256 public startBlock;
    /// @notice The block number when rewards ends.
    uint256 public endBlock;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(
        LaunchPoolToken _lpt,
        uint256 _rewardLimit,
        uint256 _startBlock,
        uint256 _endBlock
    ) public {
        require(address(_lpt) != address(0), "constructor: _lpt must not be zero address");
        require(_endBlock > _startBlock, "constructor: end must be after start");
        require(_rewardLimit > 0, "constructor: _rewardLimit must be greater than zero");

        lpt = _lpt;
        rewardLimit = _rewardLimit;
        startBlock = _startBlock;
        endBlock = _endBlock;

        lptPerBlock = rewardLimit.div(endBlock.sub(startBlock));
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    function add(uint256 _allocPoint, IERC20 _lpToken, uint256 _tokenCap, bool _withUpdate) public onlyOwner {
        require(block.number < endBlock, "add: must be before end");
        require(address(_lpToken) != address(0), "add: _lpToken must not be zero address");

        if (_withUpdate) {
            massUpdatePools();
        }

        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(PoolInfo({
            lpToken : _lpToken,
            allocPoint : _allocPoint,
            lastRewardBlock : lastRewardBlock,
            accLptPerShare : 0,
            tokenCap: _tokenCap
            }));
    }

    // Update the given pool's allocation point. Can only be called by the owner.
    function set(uint256 _pid, uint256 _allocPoint, uint256 _tokenCap, bool _withUpdate) public onlyOwner {
        require(block.number < endBlock, "set: must be before end");
        require(_pid < poolInfo.length, "set: invalid _pid");

        if (_withUpdate) {
            massUpdatePools();
        }

        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);

        poolInfo[_pid].allocPoint = _allocPoint;
        poolInfo[_pid].tokenCap = _tokenCap;
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        return _to.sub(_from);
    }

    // View function to see pending LPTs on frontend.
    function pendingLpt(uint256 _pid, address _user) external view returns (uint256) {
        require(_pid < poolInfo.length, "pendingLpt: invalid _pid");

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];

        uint256 accLptPerShare = pool.accLptPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));

        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 maxEndBlock = block.number <= endBlock ? block.number : endBlock;
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, maxEndBlock);
            uint256 lptReward = multiplier.mul(lptPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
            accLptPerShare = accLptPerShare.add(lptReward.mul(1e18).div(lpSupply));
        }

        return user.amount.mul(accLptPerShare).div(1e18).sub(user.rewardDebt);
    }

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        require(_pid < poolInfo.length, "updatePool: invalid _pid");

        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }

        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }

        uint256 maxEndBlock = block.number <= endBlock ? block.number : endBlock;
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, maxEndBlock);
        uint256 lptReward = multiplier.mul(lptPerBlock).mul(pool.allocPoint).div(totalAllocPoint);

        pool.accLptPerShare = pool.accLptPerShare.add(lptReward.mul(1e18).div(lpSupply));
        pool.lastRewardBlock = maxEndBlock;
    }

    // Deposit LP tokens to staking contract for LPT allocation.
    function deposit(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        require(user.amount.add(_amount) <= pool.tokenCap, "deposit: can not exceed pool token cap");

        updatePool(_pid);

        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accLptPerShare).div(1e18).sub(user.rewardDebt);
            if (pending > 0) {
                safeLptTransfer(msg.sender, pending);
            }
        }

        if (_amount > 0) {
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount.add(_amount);
        }

        user.rewardDebt = user.amount.mul(pool.accLptPerShare).div(1e18);
        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw LP tokens from staking contract.
    function withdraw(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        require(user.amount >= _amount, "withdraw: _amount not good");

        updatePool(_pid);

        uint256 pending = user.amount.mul(pool.accLptPerShare).div(1e18).sub(user.rewardDebt);
        if (pending > 0) {
            safeLptTransfer(msg.sender, pending);
        }

        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }

        user.rewardDebt = user.amount.mul(pool.accLptPerShare).div(1e18);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public {
        require(_pid < poolInfo.length, "updatePool: invalid _pid");

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        uint256 amount = user.amount;
        user.amount = 0;
        user.rewardDebt = 0;

        pool.lpToken.safeTransfer(address(msg.sender), amount);
        emit EmergencyWithdraw(msg.sender, _pid, amount);
    }

    // Safe LPT transfer function, just in case if rounding error causes pool to not have enough LPTs.
    function safeLptTransfer(address _to, uint256 _amount) internal {
        uint256 lptBal = lpt.balanceOf(address(this));
        if (_amount > lptBal) {
            lpt.transfer(_to, lptBal);
        } else {
            lpt.transfer(_to, _amount);
        }
    }
}
