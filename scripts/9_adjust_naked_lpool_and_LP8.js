const prompt = require('prompt-sync')();

const LaunchPoolStakingMetadata = require('../artifacts/LaunchPoolStaking.json');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Setting up pools with the account:",
    await deployer.getAddress()
  );

  const stakingAddress = prompt('Staking address? ');

  console.log('Staking', stakingAddress);

  const staking = new ethers.Contract(
    stakingAddress,
    LaunchPoolStakingMetadata.abi,
    deployer //provider
  );

  const pools = [
    [0, 0, '0x6149C26Cd2f7b5CCdb32029aF817123F6E37Df5B', 10000000], // LPT (naked)
    [17, Math.trunc((7.0588 + 2.9412) * 10000), '0xa85be3676C951EBC82C89782aBA8da6089D69cb5', 5],  // LP8
  ];

  console.log(`Adding ${pools.length} pools`);

  for (let x = 0; x < pools.length; x++) {
    const [pid, allocPoint, tokenAddress, maxStakingPerUser] = pools[x]

    const decimals = 18; // both 18 DP

    prompt(`Updating pool ${x + 1} with data {${pid}-${allocPoint}-${tokenAddress}-${maxStakingPerUser}} - hit enter to continue`);

    /// @notice Update a pool's allocation point to increase or decrease its share of contract-level rewards
    /// @notice Can also update the max amount that can be staked per user
    /// @dev Can only be called by the owner
    /// @param _pid ID of the pool being updated
    /// @param _allocPoint New allocation point
    /// @param _maxStakingAmountPerUser Maximum amount that a user can deposit into the far
    /// @param _withUpdate Set to true if you want to update all pools before making this change - it will checkpoint those rewards
    // function set(uint256 _pid, uint256 _allocPoint, uint256 _maxStakingAmountPerUser, bool _withUpdate) public onlyOwner {

    // await staking.set(
    //   pid.toString(),
    //   allocPoint.toString(),
    //   ethers.utils.parseUnits(maxStakingPerUser.toString(), decimals),
    //   false
    // );

    console.log(`pool update for ${tokenAddress} with weighting of ${allocPoint.toString()}`);
  }

  console.log('Finished!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
