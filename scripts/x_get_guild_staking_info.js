const prompt = require('prompt-sync')();

const LaunchPoolStakingMetadata = require('../artifacts/LaunchPoolStakingWithGuild.json');
const ERC20Metadata = require('../artifacts/StakingERC20.json');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Setting up guild rewards using the account:",
    await deployer.getAddress()
  );

  const stakingAddress = prompt('Staking address? ');

  console.log('Staking', stakingAddress);

  const staking = new ethers.Contract(
    stakingAddress,
    LaunchPoolStakingMetadata.abi,
    deployer //provider
  );

  const guildAddress = await staking.rewardGuildBank()

  console.log('guild addr', guildAddress)

  const token = new ethers.Contract(
    '0x6149C26Cd2f7b5CCdb32029aF817123F6E37Df5B',
    ERC20Metadata.abi,
    deployer //provider
  );

  console.log('balance of guild', (await token.balanceOf(guildAddress)).toString())

  console.log('Finished!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
