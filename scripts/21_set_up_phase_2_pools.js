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
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8330000', '8330250', '8330750', ethers.utils.parseEther('5'), deployerAddress, '50'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8330000', '8330250', '8330750', ethers.utils.parseEther('5'), deployerAddress, '250'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8330000', '8330250', '8330750', ethers.utils.parseEther('5'), deployerAddress, '10000000']
    ], // Mixsome (All Pools)
    [
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8330500', '8330750', '8331250', ethers.utils.parseEther('5'), deployerAddress, '50'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8330500', '8330750', '8331250', ethers.utils.parseEther('5'), deployerAddress, '250'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8330500', '8330750', '8331250', ethers.utils.parseEther('5'), deployerAddress, '10000000']
    ], // Unizen (All Pools)
    [
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8331000', '8331250', '8331750', ethers.utils.parseEther('5'), deployerAddress, '50'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8331000', '8331250', '8331750', ethers.utils.parseEther('5'), deployerAddress, '250'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8331000', '8331250', '8331750', ethers.utils.parseEther('5'), deployerAddress, '10000000']
    ], // Blocky Blocks (All Pools)
    [
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8331500', '8331750', '8332250', ethers.utils.parseEther('5'), deployerAddress, '50'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8331500', '8331750', '8332250', ethers.utils.parseEther('5'), deployerAddress, '250'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8331500', '8331750', '8332250', ethers.utils.parseEther('5'), deployerAddress, '10000000']
    ], // Coin Shapers (All Pools)
    [
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8332000', '8332500', '8332750', ethers.utils.parseEther('5'), deployerAddress, '50'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8332000', '8332500', '8332750', ethers.utils.parseEther('5'), deployerAddress, '250'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8332000', '8332500', '8332750', ethers.utils.parseEther('5'), deployerAddress, '10000000']
    ], // Alphabit (All Pools)
    [
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8336000', '8336250', '8336750', ethers.utils.parseEther('5'), deployerAddress, '50'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8336000', '8336250', '8336750', ethers.utils.parseEther('5'), deployerAddress, '250'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8336000', '8336250', '8336750', ethers.utils.parseEther('5'), deployerAddress, '10000000']
    ], // To The Moon  (All Pools)
    [
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8336500', '8336750', '8337250', ethers.utils.parseEther('5'), deployerAddress, '50'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8336500', '8336750', '8337250', ethers.utils.parseEther('5'), deployerAddress, '250'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8336500', '8336750', '8337250', ethers.utils.parseEther('5'), deployerAddress, '10000000']
    ], // CircleChain (All Pools)
    [
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8337000', '8337250', '8337750', ethers.utils.parseEther('5'), deployerAddress, '50'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8337000', '8337250', '8337750', ethers.utils.parseEther('5'), deployerAddress, '250'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8337000', '8337250', '8337750', ethers.utils.parseEther('5'), deployerAddress, '10000000']
    ], // Digitalist (All Pools)
    [
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8337500', '8337750', '8338250', ethers.utils.parseEther('5'), deployerAddress, '50'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8337500', '8337750', '8338250', ethers.utils.parseEther('5'), deployerAddress, '250'],
      ['0x8370454ee905f2328ca80dbb955b567c417d0d63', '8337500', '8337750', '8338250', ethers.utils.parseEther('5'), deployerAddress, '10000000']
    ], // Firechain (All Pools)
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
