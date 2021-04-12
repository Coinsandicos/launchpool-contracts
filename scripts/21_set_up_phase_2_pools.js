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

  const projects = [
    [
      ['0xc52c326331e9ce41f04484d3b5e5648158028804', '12230800', '12244300', '12251050', ethers.utils.parseEther('16.666667'), '50'], // 50 limit
      ['0xc52c326331e9ce41f04484d3b5e5648158028804', '12230800', '12244300', '12251050', ethers.utils.parseEther('16.666667'), '250'], // 250 limit
      ['0xc52c326331e9ce41f04484d3b5e5648158028804', '12230800', '12244300', '12251050', ethers.utils.parseEther('16.666667'), '10000000'] // No limit
    ], // Unizen - Raising 50 ETH split 3 ways in 3 pools. 16.666667 * 3 = 50.000001 ETH
  ];

  console.log(`Adding 3 pools for ${projects.length} projects`);

  for (let x = 0; x < projects.length; x++) {
    const projectPools = projects[x]

    for (let y = 0; y < projectPools.length; y++) {
      const [
        rewardToken,
        tokenAllocStartBlock,
        stakingEndBlock,
        pledgeFundingEndBlock,
        targetRaise,
        maxStakingPerUser
      ] = projectPools[y]

      //prompt(`Adding pool ${y + 1} with data {${rewardToken}-${tokenAllocStartBlock}-${stakingEndBlock}} - hit enter to continue`);

      await staking.add(
        rewardToken,
        tokenAllocStartBlock,
        stakingEndBlock,
        pledgeFundingEndBlock,
        targetRaise,
        ethers.utils.parseEther(maxStakingPerUser.toString()),
        false
      );

      console.log(`pool added`);
    }
  }

  console.log('Finished!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
