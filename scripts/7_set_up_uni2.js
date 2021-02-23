const prompt = require('prompt-sync')();

const LaunchPoolStakingMetadata = require('../artifacts/LaunchPoolStaking.json');
const ERC20Metadata = require('../artifacts/StakingERC20.json');

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
    [Math.trunc(10.2941 * 10000), '0x2F85E11f6F12eaD6Af643F083a34E001030D2a6F', 10000000], // LPT/ETH UNI-V2
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
