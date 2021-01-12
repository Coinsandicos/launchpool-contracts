const {BigNumber} = require('ethers');

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log(
    "Deploying $DCAS token and chef contract with the account:",
    deployerAddress
  );

  const ONE_MILL = BigNumber.from('1000000').mul(BigNumber.from('10').pow(BigNumber.from('18')));

  const DeFiCasinoToken = await ethers.getContractFactory("DeFiCasinoToken");
  const deFiCasinoToken = await DeFiCasinoToken.deploy(
    ONE_MILL,
    deployerAddress,
    deployerAddress
  );

  console.log('DeFiCasinoToken token contract deployed at:', (await deFiCasinoToken.deployed()).address);

  const MasterChef = await ethers.getContractFactory("MasterChef");
  const masterChef = await MasterChef.deploy(
    deFiCasinoToken.address,
    ONE_MILL,
    '8875700',
    '8985700',
    deployerAddress
  ); // 1000 tokens per block

  console.log('Chef contract deployed at:', (await masterChef.deployed()).address);

  await (await deFiCasinoToken.deployed()).changeMinter((await masterChef.deployed()).address);
  console.log('Switched minter to MasterChef');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
