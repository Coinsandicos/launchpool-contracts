var prompt = require('prompt-sync')();
const MasterChef = require('../artifacts/MasterChef.json');
const {BigNumber} = require('ethers');

async function main() {
    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    console.log(
        "Whitelisting mock erc20 contract with the account:",
        deployerAddress
    );

    const ONE_MILL = BigNumber.from('1000000').mul(BigNumber.from('10').pow(BigNumber.from('18')));

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const tapToken = await MockERC20.deploy(
      "FLIP",
      "FLIP",
      ONE_MILL,
    );

    console.log('token contract deployed at:', (await tapToken.deployed()).address);

    const masterChefAddress = prompt('Masterchef address? ');
    const chef = new ethers.Contract(
        masterChefAddress,
        MasterChef.abi,
        deployer //provider
    );

    await chef.whitelistStakingToken((await tapToken.deployed()).address, 100, false);

    console.log('whitelisted:', (await tapToken.deployed()).address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
