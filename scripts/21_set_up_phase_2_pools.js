const prompt = require('prompt-sync')();

const LaunchPoolStakingMetadata = require('../artifacts/contracts/LaunchPoolFundRaisingWithVesting.sol/LaunchPoolFundRaisingWithVesting.json');

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress()
  console.log(
    "Setting up pools with the account:",
    deployerAddress
  );

  const stakingAddress = prompt('Staking address? ');

  console.log('Staking', stakingAddress);

  const staking = new ethers.Contract(
    stakingAddress,
    LaunchPoolStakingMetadata.abi,
    deployer //provider
  );

  const pools = [
    [
      '0x8370454ee905f2328ca80dbb955b567c417d0d63', //Blockrocket
      '8296971',
      '8309971',
      '8316471',
      ethers.utils.parseEther('5'),
      deployerAddress,
      '100'
    ]
  ];

  console.log(`Adding ${pools.length} pools`);

  for (let x = 0; x < pools.length; x++) {
    const [
      rewardToken,
      tokenAllocStartBlock,
      stakingEndBlock,
      pledgeFundingEndBlock,
      targetRaise,
      fundRaisingRecipient,
      maxStakingPerUser
    ] = pools[x]

    prompt(`Adding pool ${x + 1} with data {${rewardToken}-${tokenAllocStartBlock}-${stakingEndBlock}} - hit enter to continue`);

    await staking.add(
      rewardToken,
      tokenAllocStartBlock,
      stakingEndBlock,
      pledgeFundingEndBlock,
      targetRaise,
      fundRaisingRecipient,
      ethers.utils.parseEther(maxStakingPerUser.toString()),
      false
    );

    console.log(`pool added`);
  }

  console.log('Finished!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
