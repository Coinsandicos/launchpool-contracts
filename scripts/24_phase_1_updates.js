const prompt = require('prompt-sync')();
const LaunchPoolStakingMetadata = require('../artifacts/contracts/LaunchPoolStaking.sol/LaunchPoolStaking.json');

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
  const UNIV2PoolId = 39

  const updates = [
    [2, LP8PoolId], // SHR -> LP8
    [5, LP8PoolId], // BONDLY -> LP8
    [6, LP8PoolId], // RUNE Thor -> LP8
    [7, LP8PoolId], // UNI -> LP8
    [8, LP8PoolId], // SUSHI -> LP8
    [9, LP8PoolId], // 1INCH -> LP8

    // Re-direct to UNI-v2
    [1, UNIV2PoolId], // STPT -> UniV2
    [4, UNIV2PoolId], // POLS -> UniV2
  ]

  console.log(`${updates.length} updates to perform`);

  for (let j = 0; j < updates.length; j++) {
    const [fromPid, toPid] = updates[j]

    const fromPoolInfo = await staking.poolInfo(fromPid)
    const toPoolInfo = await staking.poolInfo(toPid)

    const toPoolNewAlloc = toPoolInfo.allocPoint.add(fromPoolInfo.allocPoint)

    prompt(`Setting alloc of ${fromPid} to 0 and increasing ${toPid} to ${toPoolNewAlloc.toString()}`);

    await staking.set(
      fromPid.toString(),
      '0',
      fromPoolInfo.maxStakingAmountPerUser,
      true // mass update true
    );

    await staking.set(
      toPid.toString(),
      toPoolNewAlloc,
      toPoolInfo.maxStakingAmountPerUser,
      true // mass update true
    );

    const fromPoolInfoAfter = await staking.poolInfo(fromPid)
    const toPoolInfoAfter = await staking.poolInfo(toPid)

    console.log(`Pool ID ${fromPid} alloc after: ${fromPoolInfoAfter.allocPoint.toString()}`)
    console.log(`Pool ID ${toPid} alloc after: ${toPoolInfoAfter.allocPoint.toString()}`)
  }

  console.log('Finished!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
