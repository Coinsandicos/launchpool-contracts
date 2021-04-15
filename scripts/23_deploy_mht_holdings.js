const prompt = require('prompt-sync')();

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress()
  console.log(
    "Deploying launch holdings using the account:",
    deployerAddress
  );

  const tokenName = 'MHT';
  const tokenSymbol = 'MHT';
  const initialSupply = '6472492';
  const initialSupplyRecipient = deployerAddress; // deployer

  console.log('\nToken name', tokenName);
  console.log('Token symbol', tokenSymbol);
  console.log('Initial supply', initialSupply);
  console.log('Initial supply recipient', initialSupplyRecipient);

  prompt('\nIf happy, hit enter...\n');

  const LaunchHoldingsFactory = await ethers.getContractFactory("HoldingToken");

  const holdingToken = await LaunchHoldingsFactory.deploy(
    tokenName,
    tokenSymbol,
    initialSupply,
    initialSupplyRecipient
  );

  await holdingToken.deployed();

  console.log('Holding token deployed at', holdingToken.address);

  console.log('Finished!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
