const prompt = require('prompt-sync')();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Deploying LPT token with the account:",
    await deployer.getAddress()
  );

  const initialSupply = prompt('Initial supply? (Ether amount) ');
  const initialSupplyRecipient = prompt('Initial supply recipient? ');
  const minter = prompt('Minter? ');

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

  console.log('Finished!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
