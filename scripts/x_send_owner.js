const prompt = require('prompt-sync')();

const LaunchPoolFundRaisingWithVestingMetadata = require('../artifacts/contracts/LaunchPoolFundRaisingWithVesting.sol/LaunchPoolFundRaisingWithVesting.json');

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log(
    "Transferring ownership with the account:",
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

  await staking.transferOwnership('0x3A53b311089DB9b5FE22DA1100E3046c83A5507d');

  console.log('Finished!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
