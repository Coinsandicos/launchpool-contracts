const prompt = require('prompt-sync')();

const LaunchPoolFundRaisingWithVestingMetadata = require('../artifacts/contracts/LaunchPoolFundRaisingWithVesting.sol/LaunchPoolFundRaisingWithVesting.json');

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress()
  console.log(
    "Setting up pools with the account:",
    deployerAddress
  );

  const fundRaisingAddress = prompt('Fund raising contract address (Phase 2)? ');

  console.log('Phase 2 contract address', fundRaisingAddress);

  prompt('\nIf happy, hit enter...\n');

  const staking = new ethers.Contract(
    fundRaisingAddress,
    LaunchPoolFundRaisingWithVestingMetadata.abi,
    deployer //provider
  );

  const projects = [
    [
      ['TODO Reward token', '12250400', '12276800', '12283400', ethers.utils.parseEther('83.333337'), '50'], // 50 limit
      ['TODO Reward token', '12250400', '12276800', '12283400', ethers.utils.parseEther('83.333337'), '250'], // 250 limit
      ['TODO Reward token', '12250400', '12276800', '12283400', ethers.utils.parseEther('83.333337'), '10000000'] // No limit
    ], // Mixsome - Raising 250 ETH divided 3 ways. 83.333337 * 3 = 250.000011 ETH
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
