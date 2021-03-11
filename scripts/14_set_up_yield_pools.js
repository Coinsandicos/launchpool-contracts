const prompt = require('prompt-sync')();

const LaunchPoolStakingMetadata = require('../artifacts/LaunchPoolStakingWithGuild.json');
const ERC20Metadata = require('../artifacts/StakingERC20.json');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Setting up pools for YLD staking using the account:",
    await deployer.getAddress()
  );

  const stakingAddress = prompt('Staking address? ');

  console.log('Staking', stakingAddress);

  const staking = new ethers.Contract(
    stakingAddress,
    LaunchPoolStakingMetadata.abi,
    deployer //provider
  );

  const lpoolTokenAddress = '0x6149C26Cd2f7b5CCdb32029aF817123F6E37Df5B'

  const pools = [
    [100, lpoolTokenAddress, 50], // staking limit of 50 LPOOL
    [100, lpoolTokenAddress, 250], // staking limit of 250 LPOOL
    [100, lpoolTokenAddress, 10000000], // staking limit of 10mil LPOOL
  ];

  console.log(`Adding ${pools.length} pools`);

  for (let x = 0; x < pools.length; x++) {
    const [allocPoint, tokenAddress, maxStakingPerUser] = pools[x]

    prompt(`Adding pool ${x + 1} with data {${allocPoint}-${tokenAddress}-${maxStakingPerUser}} - hit enter to continue`);

    await staking.add(
      allocPoint.toString(),
      tokenAddress,
      ethers.utils.parseEther(maxStakingPerUser.toString()),
      false
    );

    console.log(`pool ${x+1} added with staking limit of ${maxStakingPerUser.toString()}`);
  }

  console.log('Finished!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
