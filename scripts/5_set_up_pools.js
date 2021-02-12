const prompt = require('prompt-sync')();

const LaunchPoolStakingMetadata = require('../artifacts/LaunchPoolStaking.json');
const ERC20Metadata = require('../artifacts/StakingERC20.json');

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

  const pools = [
    [Math.trunc(2.9412 * 10000),  '0x6149C26Cd2f7b5CCdb32029aF817123F6E37Df5B', 10000000], // LPT (naked)
    // [Math.trunc(8.8235 * 10000),  '', TODO], // LPT/ETH UNI-V2
    [Math.trunc(1.4706 * 10000), '0xde7d85157d9714eadf595045cc12ca4a5f3e2adb', 350000], // STPT
    [Math.trunc(1.4706 * 10000), '0xd98f75b1a3261dab9eed4956c93f33749027a964', 500000], // SHR
    [Math.trunc(1.4706 * 10000), '0x8c8687fc965593dfb2f0b4eaefd55e9d8df348df', 3100], // PAID
    [Math.trunc(2.0588 * 10000), '0x83e6f1E41cdd28eAcEB20Cb649155049Fac3D5Aa', 4000], // POLS
    [Math.trunc(1.4706 * 10000), '0xd2dda223b2617cb616c1580db421e4cfae6a8a85', 27500], // BONDLY
    [Math.trunc(2.0588 * 10000), '0x3155ba85d5f96b2d030a4966af206230e46849cb', 2200], // RUNE - thorchain?
    [Math.trunc(2.0588 * 10000), '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', 500], // UNI
    [Math.trunc(2.0588 * 10000), '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2', 690], // SUSHI
    [Math.trunc(2.0588 * 10000), '0x111111111117dc0aa78b770fa6a738034120c302', 2000], // 1INCH
    [Math.trunc(1.7647 * 10000), '0x51bBE29e4BF7A07E036d87993d98058269bE8B27', 5], // LP1
    [Math.trunc(1.7647 * 10000), '0xAe33E20790528CF40BA312C78f4741a340375d54', 5],
    [Math.trunc(1.7647 * 10000), '0xEe2244a98279558248C4A3ff7fff1f2e7e68AA06', 5],
    [Math.trunc(1.7647 * 10000), '0xF3819ad365aBd0373D58017442c1C7B9Cbc2E166', 5],
    [Math.trunc(1.7647 * 10000), '0x4bF95381e61014c4CE99e9Ab8CDE71bfbC191931', 5],
    [Math.trunc(1.7647 * 10000), '0xCa84d42Af8a86Df06b114cf1D2371F73BEa6eE51', 5],
    [Math.trunc(1.7647 * 10000), '0x43c5FE8506B18DBADe8970103f227942D893CC9f', 5],
    [Math.trunc(7.0588 * 10000), '0xa85be3676C951EBC82C89782aBA8da6089D69cb5', 5],
    [Math.trunc(6.1765 * 10000), '0x7E6C5E1e5fC3024Ab05985b079172430184A6483', 5],
    [Math.trunc(5.8824 * 10000), '0xF36742519DD2d8eFdBEc64F40f859602faC4d71F', 5],
    [Math.trunc(1.4706 * 10000), '0xfa2c155CdF3DcdA80794244130B1379f8478DBB7', 5],
    [Math.trunc(1.4706 * 10000), '0xd9FbC822A3b96C0D92207639dC0B316d25f46B2d', 5],
    [Math.trunc(1.4706 * 10000), '0x02dEc1beC9f68E28778eFD4675949334e6F9f6C0', 5],
    [Math.trunc(1.4706 * 10000), '0x64d939ceEe94f3eEdBfC1752e56AA5F677eb7aBE', 5],
    [Math.trunc(1.4706 * 10000), '0x0c046F2546e50Eb5BDB89D29370d5Ed00ae4959d', 5],
    [Math.trunc(1.4706 * 10000), '0x8cC2d5cF9D865Df920B1B3066Db0De4b593a7EFE', 5],
    [Math.trunc(1.4706 * 10000), '0x8554f9ABF5348fA8A7A900802e2842474e3C5483', 5],
    [Math.trunc(0.2941 * 10000), '0x6a378700D279F88B3BF0eC3E3114B2e8D9F0d740', 5],
    [Math.trunc(1.4706 * 10000), '0x6AeB27E67EdBfCDE209Ec6b08FC88C01B4148E82', 5],
    [Math.trunc(0.2941 * 10000), '0x658b561E98cA48ea11028193d31c18001856dEdF', 5],
    [Math.trunc(0.2941 * 10000), '0x61dF526DD33B7b20Ff82295dAbb52b7aB8A42860', 5],
    [Math.trunc(0.2941 * 10000), '0xa99eDa6d50E2946E3fF34a74b6008A0D10732A51', 5],
    [Math.trunc(1.4706 * 10000), '0x36fde87f35A3f46D6bE39b6A45b3488F8bEEa48B', 5],
    [Math.trunc(0.2941 * 10000), '0x8e399A1aa50a79987ade1245e9c14f49dF7BB364', 5],
    [Math.trunc(0.8824 * 10000), '0x26f250848bAA311A646651c8BEDc931e763E9d7A', 5], // LP25
    [Math.trunc(1.4706 * 10000),  TODO, 5], // LP26
    [Math.trunc(0.5882 * 10000),  TODO, 5], // LP27
    [Math.trunc(0.5882 * 10000),  TODO, 5], // LP28
    [Math.trunc(22.3529 * 10000), TODO, 5], // LP29 / Endeavor
  ];

  console.log(`Adding ${pools.length} pools`);

  for (let x = 0; x < pools.length; x++) {

    prompt(`Adding pool ${x + 1} - hit enter to continue`);

    const [allocPoint, tokenAddress, maxStakingPerUser] = pools[x]

    const token = new ethers.Contract(
      tokenAddress,
      ERC20Metadata.abi,
      deployer //provider
    );

    const decimals = await token.decimals()

    await staking.add(
      allocPoint.toString(),
      tokenAddress,
      ethers.utils.parseUnits(maxStakingPerUser.toString(), decimals),
      false
    );

    console.log(`pool added for ${tokenAddress} with weighting of ${ethers.utils.parseEther(allocPoint.toString())}`);
  }

  console.log('Finished!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
