const prompt = require('prompt-sync')();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Deploying staking contract with guild using the account:",
    await deployer.getAddress()
  );

  const tokenAddress = prompt('LPT token address? '); // 0x6149C26Cd2f7b5CCdb32029aF817123F6E37Df5B
  const maxLPTRewards = prompt('Max $LPOOL rewards? '); // 242054.6475 $LPOOL
  const startBlock = prompt('Start block? '); // 11926500
  const endBlock = prompt('End block? '); // 12501221

  console.log('LPT token', tokenAddress);
  console.log('Max LPT rewards', maxLPTRewards);
  console.log('Start block', startBlock);
  console.log('End block', endBlock);

  prompt('If happy, hit enter...');

  const LaunchPoolStakingFactory = await ethers.getContractFactory("LaunchPoolStakingWithGuild");

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
