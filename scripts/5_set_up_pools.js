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
    '0x713D050d862FbE72BB529c34f5b278b4D441056F',
    '0xbdc6D2436B5A94b3C36fD1Ca8e389385872B4dd4',
    '0x4f4306492D807344721faED2fa690774E73D6bdC',
    '0x864213560177551bE341e0CfC04a555E734DAd53',
    '0xAbE311aa54F22727d580aCD9C10b88Dc88225AB1',
    '0x9b8dDd91eD4348048EA9E55419442b80eA73238A',
    '0xF2b96e2066Bf39826d3E2911cFd4aDf33578aCB4',
    '0x7f48569ac7a3B03EDCcf8C1Ce3934A703a296c7D',
    '0xbc9E2e64e6554620777E9a3435cC97137Dc12aa0',
    '0xc30555e08b34d868aFC95562140A93619483C9a5',
    '0x4dC5264E9636bA35496D282793f8A3657B414Ed1',
    '0x08c4A5f06Eba18417B34B25cEb289370f4f6aA5A',
    '0x199B054104f4B357d95C19B6131764221870445D',
    '0x3DacEfD793cB863e41cF58ebfb4640d0DF18644A',
    '0x5148384A13C8cEF4E31a29Af82dF81593Da6C5Ea',
    '0x69bB8ddDf293BB08bA7b6A30F21c6b806572Bf60',
    '0xeF190e713d962B92458d05B61f1610F4632527ff',
    '0xdaddcd34Ec054bB902bf37C4c7fF8A7Db8a7b479',
    '0x7549111ccd1AdCFd7dbC3D23e26A2D5a64f09Aa3',
    '0x5080720d10A76d0D76d796Fc8E331Ca11E2459ac',
    '0x78557d500F8c3AAdaf9A5757cE0ee3Bd256899D0',
    '0x872f02d48506D715cc83B7D97e9E00C5C7D755d3',
    '0x2784ef5bAd16f03990F7d035193c897D88E61524',
    '0x08e65140123829BDFe2f3FC44511EF2d9F716a79',
    '0x9621ef6563C1213854fCF66112Dd570B2E24e41d',
    '0x844172aF970D04D297A8462673626e15A0C3964e',
    '0x2B6d603752a825BcFa6abaE2454d4E0A73037b82',
    '0x660F27F688356008Aa41D646B823fdF169D62758',
    '0x0915ded174C446CEefdff2a2d862F2579E391c93',
    '0x4213f6f4e0ff25b889d2a7191deb7FDb7aC2A6e8',
    '0x62bfc84ab4877a796893918CEc37953f7DA1fd2f',
    '0x2783Ac66e19f557B9DBeB098c37Fe1003CA4e524'
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
