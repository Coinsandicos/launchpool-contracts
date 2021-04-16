const prompt = require('prompt-sync')();

const LaunchPoolFundRaisingWithVestingABI = require('../artifacts/contracts/LaunchPoolFundRaisingWithVesting.sol/LaunchPoolFundRaisingWithVesting.json').abi;
const ERC20Metadata = require('../artifacts/contracts/StakingERC20.sol/StakingERC20.json');

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress()
  console.log(
    "Setting up rewards for pools with the account:",
    deployerAddress
  );

  const fundRaisingAddress = prompt('Fund raising contract address (Phase 2)? ');
  const rewardTokenAddress = prompt('Reward Token address? ');

  console.log('\nFund raising contract address', fundRaisingAddress);
  console.log('Reward token contract address', rewardTokenAddress);

  prompt('\nIf happy, hit enter...\n');

  const fundRaising = new ethers.Contract(
    fundRaisingAddress,
    LaunchPoolFundRaisingWithVestingABI,
    deployer // provider
  );

  const rewardToken = new ethers.Contract(
    rewardTokenAddress,
    ERC20Metadata.abi,
    deployer
  )

  console.log('Approving fund raising contract to move tokens...')

  const tx = await rewardToken.approve(fundRaising.address, ethers.constants.MaxUint256)
  await tx.wait()

  console.log('Done!')

  // Script prepped for Unizen pools
  const rewardInfo = [
    [
      '0', // Pool ID
      '1111111', // Total rewards
      '12251175', // reward start block
      '12251175', // reward cliff block
      '13421050' // reward end block
    ], // Pool 0
    [
      '1', // Pool ID
      '1111111', // Total rewards
      '12251175', // reward start block
      '12251175', // reward cliff block
      '13421050' // reward end block
    ], // Pool 1
    [
      '2', // Pool ID
      '1111111', // Total rewards
      '12251175', // reward start block
      '12251175', // reward cliff block
      '13421050' // reward end block
    ], // Pool 2
  ];

  console.log(`Setting up rewards for ${rewardInfo.length} pools`);

  for (let y = 0; y < rewardInfo.length; y++) {
    const [
      pid,
      rewardAmount,
      rewardStartBlock,
      rewardCliffEnd,
      rewardEndBlock
    ] = rewardInfo[y]

    prompt(`\nAbout to send rewards - Pool ID ${pid} - Amount ${rewardAmount} - Start block ${rewardStartBlock} - Cliff end block - ${rewardCliffEnd} - End block ${rewardEndBlock}. Hit ok if happy...\n`);

    await staking.setupVestingRewards(
      pid,
      ethers.utils.parseUnits(rewardAmount, await rewardToken.decimals()),
      rewardStartBlock,
      rewardCliffEnd,
      rewardEndBlock
    );

    console.log(`reward set up for ${pid}`);
  }

  console.log('Finished!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
