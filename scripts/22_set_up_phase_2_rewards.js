const prompt = require('prompt-sync')();

const LaunchPoolStakingMetadata = require('../artifacts/contracts/LaunchPoolFundRaisingWithVesting.sol/LaunchPoolFundRaisingWithVesting.json');
const ERC20Metadata = require('../artifacts/contracts/StakingERC20.sol/StakingERC20.json');

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress()
  console.log(
    "Setting up rewards for pools with the account:",
    deployerAddress
  );

  const stakingAddress = prompt('Staking address? ');

  console.log('Staking', stakingAddress);

  const staking = new ethers.Contract(
    stakingAddress,
    LaunchPoolStakingMetadata.abi,
    deployer //provider
  );

  const lpool = new ethers.Contract(
    '0x8370454ee905f2328ca80dbb955b567c417d0d63',
    ERC20Metadata.abi,
    deployer
  )

  const tx = await lpool.approve(staking.address, ethers.constants.MaxUint256)
  await tx.wait()

  const rewardInfo = [
    ['105', '10000', '8371375', '8371500', '8371625'],
    ['106', '10000', '8371375', '8371500', '8371625'],
    ['107', '10000', '8371375', '8371500', '8371625'], // last pool for mixsome
    ['108', '10000', '8371500', '8371625', '8371750'],
    ['109', '10000', '8371500', '8371625', '8371750'],
    ['110', '10000', '8371500', '8371625', '8371750'],
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

    await staking.setupVestingRewards(
      pid,
      ethers.utils.parseEther(rewardAmount),
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
