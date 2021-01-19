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
    [0.2805555556, '', 2500],
    [0.04629629556, '', 2500],
    [0.04629629556, '', 2500],
    [0.04629629556, '', 2500],
    [0.04629629556, '', 2500],
    [0.04629629556, '', 2500],
    [0.04629629556, '', 2500],
    [0.02083333333, '', 2500],
    [0.02083333333, '', 2500],
    [0.02083333333, '', 2500],
    [0.02083333333, '', 2500],
    [0.02083333333, '', 2500],
    [0.02083333333, '', 2500],
    [0.02083333333, '', 2500],
    [0.02083333333, '', 2500],
    [0.03888888889, '', 2500],
    [0.05555555556, '', 2500],
    [0.01388888889, '', 2500],
    [0.01111111111, '', 2500],
    [0.01388888889, '', 2500],
    [0.01388888889, '', 2500],
    [0.01388888889, '', 2500],
    [0.01388888889, '', 2500],
    [0.01388888889, '', 2500],
    [0.01388888889, '', 2500],
    [0.02222222222, '', 2500],
    [0.01388888889, '', 2500],
    [0.002777777778, '', 2500],
    [0.008333333333, '', 2500],
    [0.01388888889, '', 2500],
    [0.005555555556, '', 2500],
    [0.005555555556, '', 2500],
  ];

  const tokenAddresses = [
    '0x7c2C195CD6D34B8F845992d380aADB2730bB9C6F',
    '0x8858eeB3DfffA017D4BCE9801D340D36Cf895CCf',
    '0x0078371BDeDE8aAc7DeBfFf451B74c5EDB385Af7',
    '0xf4e77E5Da47AC3125140c470c71cBca77B5c638c',
    '0xf784709d2317D872237C4bC22f867d1BAe2913AB',
    '0x3619DbE27d7c1e7E91aA738697Ae7Bc5FC3eACA5',
    '0x038B86d9d8FAFdd0a02ebd1A476432877b0107C8',
    '0x1A1FEe7EeD918BD762173e4dc5EfDB8a78C924A8',
    '0x500D1d6A4c7D8Ae28240b47c8FCde034D827fD5e',
    '0xc4905364b78a742ccce7B890A89514061E47068D',
    '0xD6C850aeBFDC46D7F4c207e445cC0d6B0919BDBe',
    '0x8B5B7a6055E54a36fF574bbE40cf2eA68d5554b3',
    '0xEcc0a6dbC0bb4D51E4F84A315a9e5B0438cAD4f0',
    '0x20Ce94F404343aD2752A2D01b43fa407db9E0D00',
    '0x1d80315fac6aBd3EfeEbE97dEc44461ba7556160',
    '0x2D8553F9ddA85A9B3259F6Bf26911364B85556F5',
    '0x52d3b94181f8654db2530b0fEe1B19173f519C52',
    '0xd15468525c35BDBC1eD8F2e09A00F8a173437f2f',
    '0x7e35Eaf7e8FBd7887ad538D4A38Df5BbD073814a',
    '0x5bcb88A0d20426e451332eE6C4324b0e663c50E0',
    '0x3521eF8AaB0323004A6dD8b03CE890F4Ea3A13f5',
    '0x53369fd4680FfE3DfF39Fc6DDa9CfbfD43daeA2E',
    '0xB00cC45B4a7d3e1FEE684cFc4417998A1c183e6d',
    '0x58F132FBB86E21545A4Bace3C19f1C05d86d7A22',
    '0xa4bcDF64Cdd5451b6ac3743B414124A6299B65FF',
    '0x22474D350EC2dA53D717E30b96e9a2B7628Ede5b',
    '0x5A0773Ff307Bf7C71a832dBB5312237fD3437f9F',
    '0x18b9306737eaf6E8FC8e737F488a1AE077b18053',
    '0xFAe0fd738dAbc8a0426F47437322b6d026A9FD95',
    '0x6082731fdAba4761277Fb31299ebC782AD3bCf24',
    '0x8456161947DFc1fC159A0B26c025cD2b4bba0c3e',
    '0x12080583C4F0211eC382d33a273E6D0f9fAb0F75',
  ];

  console.log(`Adding pools: `, pools.length);

  console.log('addresses: ', tokenAddresses.length)

  let x = 0;
  for (const pool of pools) {

    prompt(`Adding pool ${x} - hit enter to continue`);

    await staking.add(ethers.utils.parseEther(pool[0].toString()), tokenAddresses[x], pool[2], false);
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
