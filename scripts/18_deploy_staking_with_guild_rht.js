const prompt = require('prompt-sync')();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Deploying staking contract with guild using the account:",
    await deployer.getAddress()
  );


//   * Name: RHT
//   * Symbol: RHT
//   * Decimals: 18
//   * Rewards: 150,000
//   * Limit: NO LIMIT
//   * Start: (31st Mar 4pm)
//   * End: 12154500 (1st Apr)

  const tokenAddress = prompt('Token address? '); // 0x636253B86AdcfBb3A1Ac20458ccD3552e4bC3d67
  const maxRewards = prompt('Max rewards? '); // 150000 / 150k
  const startBlock = prompt('Start block? '); // 12148000 - https://etherscan.io/block/countdown/12148000
  const endBlock = prompt('End block? '); // 12154500 - https://etherscan.io/block/countdown/12154500

  console.log('Token address', tokenAddress);
  console.log('Max rewards', maxRewards);
  console.log('Start block', startBlock);
  console.log('End block', endBlock);

  prompt('If happy, hit enter...');

  const LaunchPoolStakingFactory = await ethers.getContractFactory("LaunchPoolStakingWithGuild");

  const staking = await LaunchPoolStakingFactory.deploy(
    tokenAddress,
    ethers.utils.parseEther(maxRewards),
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
