const prompt = require('prompt-sync')();

const LaunchPoolStakingMetadata = require('../artifacts/LaunchPoolStakingWithGuild.json');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Mass update using the account:",
    await deployer.getAddress()
  );

  const stakingAddress = prompt('Staking address? ');

  console.log('Staking', stakingAddress);

  const staking = new ethers.Contract(
    stakingAddress,
    LaunchPoolStakingMetadata.abi,
    deployer //provider
  );

  await staking.massUpdatePools()

  console.log('Finished!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
