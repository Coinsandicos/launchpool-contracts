const prompt = require('prompt-sync')();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Deploying launch holdings using the account:",
    await deployer.getAddress()
  );

  const tokenName = prompt('Token name? ');
  const tokenSymbol = prompt('Token symbol? ');
  const initialSupply = prompt('Initial supply? ');
  const initialSupplyRecipient = prompt('Initial supply recipient? ');

  console.log('Token name', tokenName);
  console.log('Token symbol', tokenSymbol);
  console.log('Initial supply', initialSupply);
  console.log('Initial supply recipient', initialSupplyRecipient);

  prompt('If happy, hit enter...');

  const LaunchHoldingsFactory = await ethers.getContractFactory("LaunchHoldings");

  const holdingToken = await LaunchHoldingsFactory.deploy(
    tokenName,
    tokenSymbol,
    ethers.utils.parseEther(initialSupply),
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
