const prompt = require('prompt-sync')();

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress()
  console.log(
    "Deploying launch holdings using the account:",
    deployerAddress
  );

//   * Name: RHT
//   * Symbol: RHT
//   * Decimals: 18
//   * Rewards: 150,000
//   * Limit: NO LIMIT
//   * Start: (31st Mar 4pm)
//   * End: 12154500 (1st Apr)

  const tokenName = 'RHT';
  const tokenSymbol = 'RHT';
  const initialSupply = '150000'; // 150k
  const initialSupplyRecipient = deployerAddress; // deployer

  console.log('Token name', tokenName);
  console.log('Token symbol', tokenSymbol);
  console.log('Initial supply', initialSupply);
  console.log('Initial supply recipient', initialSupplyRecipient);

  prompt('If happy, hit enter...');

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
