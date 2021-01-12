var prompt = require('prompt-sync')();
const MasterChef = require('../artifacts/MasterChef.json');
const MockERC20 = require('../artifacts/MockERC20.json');
const {BigNumber} = require('ethers');

async function main() {
    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    console.log(
        "ping:",
        deployerAddress
    );

    // const masterChefAddress = prompt('Masterchef address? ');
    // const chef = new ethers.Contract(
    //     masterChefAddress,
    //     MasterChef.abi,
    //     deployer //provider
    // );
    //
    // await chef.updateOwner(deployerAddress);

    const mockERC20Address = prompt('MockERC20 address? ');
    const mockERC20 = new ethers.Contract(
      mockERC20Address,
      MockERC20.abi,
      deployer //provider
    );

    await mockERC20.transfer(
      "0x693F55496aF37b1c000a1BEf74a0ed4ee7A92E70",
      BigNumber.from('1000').mul(BigNumber.from('10').pow(BigNumber.from('18')))
    );

    console.log('pinged...');
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
