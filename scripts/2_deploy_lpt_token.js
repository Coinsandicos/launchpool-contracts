const prompt = require('prompt-sync')();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Deploying LPT token with the account:",
    await deployer.getAddress()
  );

  const initialSupply = '10000000'; // 10 million
  const initialSupplyRecipient = await deployer.getAddress();
  const minter = '0x0000000000000000000000000000000000000000'; // no one can mint additional tokens

  console.log('\nInitial supply', initialSupply);
  console.log('\nInitial supply recipient', initialSupplyRecipient);
  console.log('\nMinter', minter);

  prompt('If happy, hit enter...');

  const LaunchPoolTokenFactory = await ethers.getContractFactory("LaunchPoolToken");

  const token = await LaunchPoolTokenFactory.deploy(
    ethers.utils.parseEther(initialSupply),
    initialSupplyRecipient,
    minter
  );

  await token.deployed();

  console.log('Token deployed at', token.address);

  // todo get address
  const nonMiningLPTRecipient = 'TODO'
  console.log(`Sending 1.5m to ${nonMiningLPTRecipient}`)
  await token.transfer(nonMiningLPTRecipient, ethers.utils.parseEther(1500000))

  console.log('Finished!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
