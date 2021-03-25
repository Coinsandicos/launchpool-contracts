const prompt = require('prompt-sync')();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Deploying staking contract with guild using the account:",
    await deployer.getAddress()
  );

  const tokenAddress = prompt('Token address? '); // 0xF94b5C5651c888d928439aB6514B93944eEE6F48 - Yield
  const maxRewards = prompt('Max rewards? '); // 500000 - 500k
  const startBlock = prompt('Start block? '); // 12043400 - https://etherscan.io/block/countdown/12043400
  const endBlock = prompt('End block? '); // 12253000 - https://etherscan.io/block/countdown/12253000

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
