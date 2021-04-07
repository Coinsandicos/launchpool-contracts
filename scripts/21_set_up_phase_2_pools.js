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
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8371000', '8371125', '8371250', ethers.utils.parseEther('1'), deployerAddress, '50'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8371000', '8371125', '8371250', ethers.utils.parseEther('1'), deployerAddress, '250'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8371000', '8371125', '8371250', ethers.utils.parseEther('1'), deployerAddress, '10000000']
    ], // mixsome
    [
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8371125', '8371250', '8371375', ethers.utils.parseEther('1'), deployerAddress, '50'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8371125', '8371250', '8371375', ethers.utils.parseEther('1'), deployerAddress, '250'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8371125', '8371250', '8371375', ethers.utils.parseEther('1'), deployerAddress, '10000000']
    ], // unizen
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
        fundRaisingRecipient,
        maxStakingPerUser
      ] = projectPools[y]

      //prompt(`Adding pool ${y + 1} with data {${rewardToken}-${tokenAllocStartBlock}-${stakingEndBlock}} - hit enter to continue`);

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
  }

  console.log('Finished!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
