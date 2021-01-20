const prompt = require('prompt-sync')();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Deploying staking contract with the account:",
    await deployer.getAddress()
  );

  const tokenAddress = prompt('LPT token address? ');
  const maxLPTRewards = prompt('Max LPT rewards amount? ');
  const startBlock = prompt('Start block? ');
  const endBlock = prompt('End block? ');

  console.log('LPT token', tokenAddress);
  console.log('Max LPT rewards', maxLPTRewards);
  console.log('Start block', startBlock);
  console.log('End block', endBlock);

  prompt('If happy, hit enter...');

  const LaunchPoolStakingFactory = await ethers.getContractFactory("LaunchPoolStaking");

  const staking = await LaunchPoolStakingFactory.deploy(
    tokenAddress,
    ethers.utils.parseEther(maxLPTRewards),
    startBlock,
    endBlock
  );

  await staking.deployed();

  console.log('Staking deployed at', staking.address);

  console.log('Finished!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
