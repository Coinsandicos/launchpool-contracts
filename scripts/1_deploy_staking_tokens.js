const _ = require('lodash')
const prompt = require('prompt-sync')();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Deploying Staking tokens with the account:",
    await deployer.getAddress()
  );

  const initialSupplyRecipient = prompt('Initial supply recipient? ');

  // remove for main
  // tokens = tokens.concat(['XTP', 'STPT', 'ZEN', 'FTM', 'SHR', 'LPT/ETH']);

  //let tokens = ['LPA'];

  const lpTokensSymbols = Array(4).fill().map((_, i) => `LP${i + 26}`) //26-29

  //tokens = tokens.concat(lpTokensSymbols);

  const StakingERC20 = await ethers.getContractFactory("StakingERC20");

  for (const symbol of lpTokensSymbols) {

    prompt(`Deploying ${symbol} - hit enter to continue`);

    const token = await StakingERC20.deploy(symbol, symbol, initialSupplyRecipient);
    await token.deployed();

    console.log(`Token deployed ${symbol} deployed at: `, token.address);
    //console.log(token.address);
  }

  console.log('Finished!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
