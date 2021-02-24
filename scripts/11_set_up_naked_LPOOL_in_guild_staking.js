const prompt = require('prompt-sync')();

const LaunchPoolStakingMetadata = require('../artifacts/LaunchPoolStakingWithGuild.json');
const ERC20Metadata = require('../artifacts/StakingERC20.json');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Setting up naked LPOOL in staking with guild using the account:",
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
    [100, '0x6149C26Cd2f7b5CCdb32029aF817123F6E37Df5B', 10000000], // $LPOOL
  ];

  console.log(`Adding ${pools.length} pools`);

  for (let x = 0; x < pools.length; x++) {
    const [allocPoint, tokenAddress, maxStakingPerUser] = pools[x]

    const token = new ethers.Contract(
      tokenAddress,
      ERC20Metadata.abi,
      deployer //provider
    );

    const decimals = await token.decimals()

    prompt(`Adding pool ${x + 1} with data {${allocPoint}-${tokenAddress}-${maxStakingPerUser}} - hit enter to continue`);

    await staking.add(
      allocPoint.toString(),
      tokenAddress,
      ethers.utils.parseUnits(maxStakingPerUser.toString(), decimals),
      false
    );

    console.log(`pool added for ${tokenAddress} with weighting of ${allocPoint.toString()}`);
  }

  console.log('Finished!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
