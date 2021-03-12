const {time, BN, expectRevert, constants, ether} = require('@openzeppelin/test-helpers');

const LaunchPoolToken = artifacts.require('LaunchPoolToken');
const LaunchPoolFundRaisingWithVesting = artifacts.require('LaunchPoolFundRaisingWithVesting');
const MockERC20 = artifacts.require('MockERC20');

require('chai').should();
const {expect} = require('chai');

contract('LaunchPoolFundRaisingWithVesting', ([deployer, alice, bob, carol, project1Admin]) => {
  const to18DP = (value) => {
    return new BN(value).mul(new BN('10').pow(new BN('18')));
  };

  const toBn = (value) => new BN(value);

  const TEN_TOKENS = to18DP('10');
  const ONE_THOUSAND_TOKENS = to18DP('1000');
  const TEN_THOUSAND_TOKENS = ONE_THOUSAND_TOKENS.muln(10);
  const ONE_HUNDRED_THOUSAND_TOKENS = TEN_THOUSAND_TOKENS.muln(10);
  const ONE_MILLION_TOKENS = to18DP('1000000');
  const TEN_MILLION_TOKENS = ONE_MILLION_TOKENS.muln(10);

  const setupUsers = async (from) => {
    await this.launchPoolToken.transfer(alice, ONE_THOUSAND_TOKENS, {from});
    await this.launchPoolToken.transfer(bob, ONE_THOUSAND_TOKENS, {from});
    await this.launchPoolToken.transfer(carol, ONE_THOUSAND_TOKENS, {from});
  };

  const pledge = async (poolId, amount, sender) => {
    const poolInfoBefore = await this.fundRaising.poolInfo(poolId)

    await this.launchPoolToken.approve(this.fundRaising.address, amount, {from: sender})
    await this.fundRaising.pledge(poolId, amount, {from: sender})

    const {amount: pledgedAmount} = await this.fundRaising.userInfo(poolId, sender)
    expect(pledgedAmount).to.be.bignumber.equal(amount)

    const poolInfoAfter = await this.fundRaising.poolInfo(poolId)
    expect(poolInfoAfter.totalStaked.sub(poolInfoBefore.totalStaked)).to.be.bignumber.equal(amount)
  }

  const POOL_ZERO = new BN('0');
  const POOL_ONE = new BN('1');

  beforeEach(async () => {
    this.launchPoolToken = await LaunchPoolToken.new(TEN_MILLION_TOKENS, deployer, {from: deployer});

    this.fundRaising = await LaunchPoolFundRaisingWithVesting.new(
      this.launchPoolToken.address,
      {from: deployer}
    )

    await setupUsers(deployer);

    this.currentBlock = await time.latestBlock();
  })

  describe.only('Fund raising end to end flow', () => {
    describe('With 1 pool set up', () => {
      beforeEach(async () => {
        // create reward token for fund raising
        this.rewardToken1 = await MockERC20.new(
          'Reward1',
          'Reward1',
          ONE_HUNDRED_THOUSAND_TOKENS,
          {from: project1Admin}
        )

        this.stakingEndBlock = '100'
        this.pledgeFundingEndBlock = '150'
        this.project1TargetRaise = ether('1000')

        await this.fundRaising.add(
          this.rewardToken1.address,
          this.stakingEndBlock,
          this.pledgeFundingEndBlock,
          this.project1TargetRaise,
          project1Admin,
          false,
          {from: deployer}
        )
      })

      it('Can farm reward tokens once all stages have passed', async () => {
        await pledge(POOL_ZERO, ONE_THOUSAND_TOKENS, alice)
      })

      describe('When another pool is set up', () => {

      })
    })
  })
})
