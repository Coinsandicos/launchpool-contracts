const prompt = require('prompt-sync')();

const LaunchPoolStakingMetadata = require('../artifacts/LaunchPoolStaking.json');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Setting up pools with the account:",
    await deployer.getAddress()
  );

  const stakingAddress = prompt('Staking address? ');

  console.log('Staking', stakingAddress);

  const staking = new ethers.Contract(
    stakingAddress,
    LaunchPoolStakingMetadata.abi,
    deployer //provider
  );

  // run before the start
  const pools = [
    [0.2805555556, '', 5],
    [0.04629629556, '', 5],
    [0.04629629556, '', 5],
    [0.04629629556, '', 5],
    [0.04629629556, '', 5],
    [0.04629629556, '', 5],
    [0.04629629556, '', 5],
    [0.02083333333, '', 5],
    [0.02083333333, '', 5],
    [0.02083333333, '', 5],
    [0.02083333333, '', 5],
    [0.02083333333, '', 5],
    [0.02083333333, '', 5],
    [0.02083333333, '', 5],
    [0.02083333333, '', 5],
    [0.03888888889, '', 5],
    [0.05555555556, '', 5],
    [0.01388888889, '', 5],
    [0.01111111111, '', 5],
    [0.01388888889, '', 5],
    [0.01388888889, '', 5],
    [0.01388888889, '', 5],
    [0.01388888889, '', 5],
    [0.01388888889, '', 5],
    [0.01388888889, '', 5],
    [0.02222222222, '', 5],
    [0.01388888889, '', 5],
    [0.002777777778, '', 5],
    [0.008333333333, '', 5],
    [0.01388888889, '', 5],
    [0.005555555556, '', 5],
    [0.005555555556, '', 5],
  ];

  const tokenAddresses = [
    '0x51bBE29e4BF7A07E036d87993d98058269bE8B27', // LP1
    '0xAe33E20790528CF40BA312C78f4741a340375d54',
    '0xEe2244a98279558248C4A3ff7fff1f2e7e68AA06',
    '0xF3819ad365aBd0373D58017442c1C7B9Cbc2E166',
    '0x4bF95381e61014c4CE99e9Ab8CDE71bfbC191931',
    '0xCa84d42Af8a86Df06b114cf1D2371F73BEa6eE51',
    '0x43c5FE8506B18DBADe8970103f227942D893CC9f',
    '0xa85be3676C951EBC82C89782aBA8da6089D69cb5',
    '0x7E6C5E1e5fC3024Ab05985b079172430184A6483',
    '0xF36742519DD2d8eFdBEc64F40f859602faC4d71F',
    '0xfa2c155CdF3DcdA80794244130B1379f8478DBB7',
    '0xd9FbC822A3b96C0D92207639dC0B316d25f46B2d',
    '0x02dEc1beC9f68E28778eFD4675949334e6F9f6C0',
    '0x64d939ceEe94f3eEdBfC1752e56AA5F677eb7aBE',
    '0x0c046F2546e50Eb5BDB89D29370d5Ed00ae4959d',
    '0x8cC2d5cF9D865Df920B1B3066Db0De4b593a7EFE',
    '0x8554f9ABF5348fA8A7A900802e2842474e3C5483',
    '0x6a378700D279F88B3BF0eC3E3114B2e8D9F0d740',
    '0x6AeB27E67EdBfCDE209Ec6b08FC88C01B4148E82',
    '0x658b561E98cA48ea11028193d31c18001856dEdF',
    '0x61dF526DD33B7b20Ff82295dAbb52b7aB8A42860',
    '0xa99eDa6d50E2946E3fF34a74b6008A0D10732A51',
    '0x36fde87f35A3f46D6bE39b6A45b3488F8bEEa48B',
    '0x8e399A1aa50a79987ade1245e9c14f49dF7BB364',
    '0x26f250848bAA311A646651c8BEDc931e763E9d7A' // LP25
  ];

  console.log(`Adding pools: `, pools.length);

  console.log('addresses: ', tokenAddresses.length)

  let x = 0;
  for (const pool of pools) {

    //prompt(`Adding pool ${x + 1} - hit enter to continue`);

    await staking.add(
      ethers.utils.parseEther(pool[0].toString()),
      tokenAddresses[x],
      ethers.utils.parseEther(pool[2].toString()), // TODO this actually needs to get the token decimal
      false
    );

    console.log(`pool added for ${tokenAddresses[x]} with weighting of ${ethers.utils.parseEther(pool[0].toString())}`);

    x++;
  }

  console.log('Finished!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
