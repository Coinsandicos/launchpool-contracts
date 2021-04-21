const prompt = require('prompt-sync')();
const LaunchPoolStakingMetadata = require('../artifacts/LaunchPoolStaking.json');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Updating pools with the account:",
    await deployer.getAddress()
  );

  const stakingAddress = prompt('Staking address? ');

  console.log('Staking', stakingAddress);

  const staking = new ethers.Contract(
    stakingAddress,
    LaunchPoolStakingMetadata.abi,
    deployer //provider
  );

  const LP8PoolId = 17

  const updates = [
    [
      [1, 0], // STPT
      [LP8PoolId, 105881 + 14705],  // LP8
    ],
    [
      [2, 0], // SHR
      [LP8PoolId, 120586 + 14705] // LP8
    ],
    [
      [4, 0], // POLS
      [LP8PoolId, 135291 + 20588] // LP8
    ],
    [
      [5, 0], // BONDLY
      [LP8PoolId, 155879 + 14705] // LP8
    ],
    [
      [6, 0], // RUNE Thor
      [LP8PoolId, 170584 + 14705] // LP8
    ],
    [
      [7, 0], // UNI
      [LP8PoolId, 185289 + 20588] // LP8
    ],
    [
      [8, 0], // SUSHI
      [LP8PoolId, 205877 + 20588] // LP8
    ],
    [
      [9, 0], // 1INCH
      [LP8PoolId, 226465 + 20588] // LP8
    ]
  ]

  console.log(`${updates.length} updates to perform`);

  for(let i = 0; i < updates.length; i++) {
    const pools = updates[i]

    prompt(`\nUpdate ${ i + 1 } - hit enter to continue\n`)

    for (let j = 0; j < pools.length; j++) {
      const [pid, allocPoint] = pools[j]

      const poolInfo = await staking.poolInfo(pid)

      prompt(`Updating pool ${pid} to alloc point ${allocPoint} - hit enter to continue`);

      /// @notice Update a pool's allocation point to increase or decrease its share of contract-level rewards
      /// @notice Can also update the max amount that can be staked per user
      /// @dev Can only be called by the owner
      /// @param _pid ID of the pool being updated
      /// @param _allocPoint New allocation point
      /// @param _maxStakingAmountPerUser Maximum amount that a user can deposit into the far
      /// @param _withUpdate Set to true if you want to update all pools before making this change - it will checkpoint those rewards
      // function set(uint256 _pid, uint256 _allocPoint, uint256 _maxStakingAmountPerUser, bool _withUpdate) public onlyOwner {

      await staking.set(
        pid.toString(),
        allocPoint.toString(),
        poolInfo.maxStakingAmountPerUser,
        true // mass update true
      );

      console.log(`pool ${pid} updated with weighting of ${allocPoint.toString()}`);

      const lp8PoolInfo = await staking.poolInfo(LP8PoolId)
      console.log(`LP8 new alloc point is: ${lp8PoolInfo.allocPoint.toString()}`)
    }
  }

  console.log('Finished!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
