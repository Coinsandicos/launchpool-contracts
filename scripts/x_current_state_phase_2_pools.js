const prompt = require('prompt-sync')();

const LaunchPoolFundRaisingWithVestingMetadata = require('../artifacts/contracts/LaunchPoolFundRaisingWithVesting.sol/LaunchPoolFundRaisingWithVesting.json');

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log(
    "Setting up pools with the account:",
    deployerAddress
  );

  const fundRaisingAddress = prompt('Contract address? ');

  console.log('fundRaisingAddress', fundRaisingAddress);

  const funding = new ethers.Contract(
    fundRaisingAddress,
    LaunchPoolFundRaisingWithVestingMetadata.abi,
    deployer //provider
  );

  for (let x = 0; x < 3; x++) {
    console.log(`looking up pool`, x);

    const {
      rewardToken,
      tokenAllocationStartBlock,
      stakingEndBlock,
      pledgeFundingEndBlock,
      targetRaise,
      maxStakingAmountPerUser
    } = await funding.poolInfo(x);

    const percentageFunded = ethers.utils.formatEther(await funding.poolIdToTotalFundedPercentageOfTargetRaise(x))

    console.log(`
    Reward Token: ${rewardToken}
    tokenAllocationStartBlock: ${tokenAllocationStartBlock}
    stakingEndBlock: ${stakingEndBlock}
    pledgeFundingEndBlock: ${pledgeFundingEndBlock}
    targetRaise: ${ethers.utils.formatEther(targetRaise.toString())}
    maxStakingAmountPerUser: ${ethers.utils.formatEther(maxStakingAmountPerUser.toString())},
    percentageFunded: ${percentageFunded}%
    \n\n
    `);
  }

  console.log('Finished!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
