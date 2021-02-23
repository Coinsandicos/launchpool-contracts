const prompt = require('prompt-sync')();

const LaunchPoolTokenMetadata = require('../artifacts/LaunchPoolToken.json');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Transfering LPT with the account:",
    await deployer.getAddress()
  );

  const tokenAddress = prompt('LPT token address? ');
  const stakingAddress = prompt('Staking address? ');
  const lptRewards = '8500000';

  console.log('LPT token', tokenAddress);
  console.log('Staking', stakingAddress);
  console.log('LPT rewards', lptRewards);

  prompt('If happy, hit enter...');

  const lptToken = new ethers.Contract(
    tokenAddress,
    LaunchPoolTokenMetadata.abi,
    deployer //provider
  );

  await lptToken.transfer(stakingAddress, ethers.utils.parseEther(lptRewards));

  console.log('Sent maxLPTReward LPT to', stakingAddress);

  console.log('Finished!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
