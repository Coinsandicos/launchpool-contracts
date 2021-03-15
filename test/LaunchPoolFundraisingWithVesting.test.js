const {time, BN, expectRevert, expectEvent, constants, ether, balance} = require('@openzeppelin/test-helpers');

const LaunchPoolToken = artifacts.require('LaunchPoolToken');
const LaunchPoolFundRaisingWithVesting = artifacts.require('LaunchPoolFundRaisingWithVesting');
const MockERC20 = artifacts.require('MockERC20');

require('chai').should();
const {expect} = require('chai');

const {fromWei} = require('web3-utils');

contract('LaunchPoolFundRaisingWithVesting', ([
                                                deployer,
                                                alice,
                                                bob,
                                                carol,
                                                daniel,
                                                ed,
                                                project1Admin,
                                                project2Admin,
                                              ]) => {
  const shouldBeNumberInEtherCloseTo = (valInWei, expected) => parseFloat(fromWei(valInWei)).should.be.closeTo(parseFloat(expected.toString()), 0.000001);

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
    await this.launchPoolToken.transfer(daniel, ONE_THOUSAND_TOKENS, {from});
    await this.launchPoolToken.transfer(ed, ONE_THOUSAND_TOKENS, {from});
  };

  const pledge = async (poolId, amount, sender) => {
    const poolInfoBefore = await this.fundRaising.poolInfo(poolId)

    await this.launchPoolToken.approve(this.fundRaising.address, amount, {from: sender})
    const {receipt} = await this.fundRaising.pledge(poolId, amount, {from: sender})

    await expectEvent(receipt, 'Pledge', {
      user: sender,
      pid: poolId,
      amount
    })

    const {amount: pledgedAmount} = await this.fundRaising.userInfo(poolId, sender)
    expect(pledgedAmount).to.be.bignumber.equal(amount)

    const poolInfoAfter = await this.fundRaising.poolInfo(poolId)
    expect(poolInfoAfter.totalStaked.sub(poolInfoBefore.totalStaked)).to.be.bignumber.equal(amount)
  }

  const fundPledge = async (poolId, sender) => {
    const poolInfoBefore = await this.fundRaising.poolInfo(poolId)
    const contractEthBalance = await balance.tracker(this.fundRaising.address)

    const pledgeFundingAmount = await this.fundRaising.getPledgeFundingAmount(poolId, {from: sender})
    const {receipt} = await this.fundRaising.fundPledge(poolId, {from: sender, value: pledgeFundingAmount})

    await expectEvent(receipt, 'PledgeFunded', {
      user: sender,
      pid: poolId,
      amount: pledgeFundingAmount
    })

    const {pledgeFundingAmount: fundingCommited, amount} = await this.fundRaising.userInfo(poolId, sender)
    expect(fundingCommited).to.be.bignumber.equal(pledgeFundingAmount)

    const poolInfoAfter = await this.fundRaising.poolInfo(poolId)
    expect(poolInfoAfter.totalRaised.sub(poolInfoBefore.totalRaised)).to.be.bignumber.equal(pledgeFundingAmount)
    expect(poolInfoAfter.totalStakeThatHasFundedPledge.sub(poolInfoBefore.totalStakeThatHasFundedPledge)).to.be.bignumber.equal(amount)
    expect(await contractEthBalance.delta()).to.be.bignumber.equal(pledgeFundingAmount)
  }

  const setupVestingRewards = async (poolId, rewardToken, rewardAmount, rewardEndBlock, pledgeFundingEndBlock, sender) => {
    await rewardToken.approve(this.fundRaising.address, rewardAmount, {from: sender})

    const guildTokenBalBefore = await rewardToken.balanceOf(this.guildBankAddress)

    const {receipt} = await this.fundRaising.setupVestingRewards(
      poolId,
      rewardAmount,
      rewardEndBlock,
      {from: sender}
    )

    await expectEvent(receipt, 'RewardsSetUp', {
      pid: poolId,
      amount: rewardAmount,
      rewardEndBlock
    })

    const guildTokenBalAfter = await rewardToken.balanceOf(this.guildBankAddress)

    expect(guildTokenBalAfter.sub(guildTokenBalBefore)).to.be.bignumber.equal(rewardAmount)

    const {
      maxRewardTokenAvailableForVesting,
      rewardPerBlock,
      lastRewardBlock,
      rewardEndBlock: rewardEndBlockFromPoolInfo
    } = await this.fundRaising.poolInfo(poolId)

    expect(maxRewardTokenAvailableForVesting).to.be.bignumber.equal(rewardAmount)
    expect(lastRewardBlock).to.be.bignumber.equal(pledgeFundingEndBlock.add(toBn(3)))
    expect(rewardEndBlockFromPoolInfo).to.be.bignumber.equal(rewardEndBlock)
    expect(rewardPerBlock).to.be.bignumber.equal(maxRewardTokenAvailableForVesting.div(rewardEndBlock.sub(pledgeFundingEndBlock.add(toBn(3)))))
  }

  const POOL_ZERO = new BN('0');
  const POOL_ONE = new BN('1');

  beforeEach(async () => {
    this.launchPoolToken = await LaunchPoolToken.new(TEN_MILLION_TOKENS, deployer, {from: deployer});

    this.fundRaising = await LaunchPoolFundRaisingWithVesting.new(
      this.launchPoolToken.address,
      {from: deployer}
    )

    this.guildBankAddress = await this.fundRaising.rewardGuildBank();

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

        this.stakingEndBlock = this.currentBlock.add(toBn('100'))
        this.pledgeFundingEndBlock = this.stakingEndBlock.add(toBn('50'))
        this.project1TargetRaise = ether('100')

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
        // let alice and bob pledge funding by staking LPOOL
        await pledge(POOL_ZERO, ONE_THOUSAND_TOKENS, alice) // Alice will have to fund 2/3 of the target raise
        await pledge(POOL_ZERO, ONE_THOUSAND_TOKENS.divn(2), bob) // Bob will have to fund 1/3

        // move past staking end
        await time.advanceBlockTo(this.stakingEndBlock.add(toBn('1')))

        // fund the pledge
        await fundPledge(POOL_ZERO, alice)
        await fundPledge(POOL_ZERO, bob)

        // move past funding period
        const _1BlockPastFundingEndBlock = this.pledgeFundingEndBlock.add(toBn('1'))
        await time.advanceBlockTo(_1BlockPastFundingEndBlock);

        // 100% funding will have taken place
        const {raised, target} = await this.fundRaising.getTotalRaisedVsTarget(POOL_ZERO)
        shouldBeNumberInEtherCloseTo(raised, fromWei(target))

        // Project admin sends the rewards tokens in relation to raise
        await setupVestingRewards(
          POOL_ZERO,
          this.rewardToken1,
          ONE_HUNDRED_THOUSAND_TOKENS,
          _1BlockPastFundingEndBlock.add(toBn('100')), // 1k tokens a block
          this.pledgeFundingEndBlock,
          project1Admin
        )

        // rewards will come through after a few blocks
        const poolInfoAfterSettingUpRewards = await this.fundRaising.poolInfo(POOL_ZERO);
        await time.advanceBlockTo(poolInfoAfterSettingUpRewards.lastRewardBlock.addn(4));

        // 5 blocks of rewards should be available
        await this.fundRaising.claimReward(POOL_ZERO, {from: alice})

        const totalRewardsForAliceAndBobAfter5Blocks = poolInfoAfterSettingUpRewards.rewardPerBlock.muln(5)
        const totalRewardsAlice = totalRewardsForAliceAndBobAfter5Blocks.muln(2).divn(3) // alice gets 2/3

        const aliceRewardTokenBalAfterClaim = await this.rewardToken1.balanceOf(alice)

        shouldBeNumberInEtherCloseTo(aliceRewardTokenBalAfterClaim, fromWei(totalRewardsAlice))

        // bob claims after 6 blocks
        const totalRewardsForAliceAndBobAfter6Blocks = poolInfoAfterSettingUpRewards.rewardPerBlock.muln(6)
        const totalRewardsBob = totalRewardsForAliceAndBobAfter6Blocks.divn(3) // bob gets 1/3

        await this.fundRaising.claimReward(POOL_ZERO, {from: bob})

        const bobRewardTokenBalAfterClaim = await this.rewardToken1.balanceOf(bob)

        shouldBeNumberInEtherCloseTo(bobRewardTokenBalAfterClaim, fromWei(totalRewardsBob))
      })
    })

    describe('When another pool is set up', () => {
      beforeEach(async () => {
        this.currentBlock = await time.latestBlock();

        // create reward token for fund raising
        this.rewardToken1 = await MockERC20.new(
          'Reward1',
          'Reward1',
          ONE_HUNDRED_THOUSAND_TOKENS,
          {from: project1Admin}
        )

        this.stakingEndBlock = this.currentBlock.add(toBn('100'))
        this.pledgeFundingEndBlock = this.stakingEndBlock.add(toBn('50'))
        this.project1TargetRaise = ether('100')

        await this.fundRaising.add(
          this.rewardToken1.address,
          this.stakingEndBlock,
          this.pledgeFundingEndBlock,
          this.project1TargetRaise,
          project1Admin,
          false,
          {from: deployer}
        )

        // let alice and bob pledge funding by staking LPOOL
        await pledge(POOL_ZERO, ONE_THOUSAND_TOKENS, alice) // Alice will have to fund 2/3 of the target raise
        await pledge(POOL_ZERO, ONE_THOUSAND_TOKENS.divn(2), bob) // Bob will have to fund 1/3

        // move past staking end
        await time.advanceBlockTo(this.stakingEndBlock.add(toBn('1')))

        // fund the pledge
        await fundPledge(POOL_ZERO, alice)
        await fundPledge(POOL_ZERO, bob)

        // move past funding period
        const _1BlockPastFundingEndBlock = this.pledgeFundingEndBlock.add(toBn('1'))
        await time.advanceBlockTo(_1BlockPastFundingEndBlock);

        // Project admin sends the rewards tokens in relation to raise
        await setupVestingRewards(
          POOL_ZERO,
          this.rewardToken1,
          ONE_HUNDRED_THOUSAND_TOKENS,
          _1BlockPastFundingEndBlock.add(toBn('100')), // 1k tokens a block
          this.pledgeFundingEndBlock,
          project1Admin
        )

        // rewards will come through after a few blocks
        const poolInfoAfterSettingUpRewards = await this.fundRaising.poolInfo(POOL_ZERO);
        await time.advanceBlockTo(poolInfoAfterSettingUpRewards.lastRewardBlock.addn(4));

        // alice and bob claim their first few blocks of rewards
        await this.fundRaising.claimReward(POOL_ZERO, {from: alice})

        this.lastClaimPoolZeroBlockNumber = await time.latestBlock();

        await this.fundRaising.claimReward(POOL_ZERO, {from: bob})

        // create reward token 2 for fund raising
        this.rewardToken2 = await MockERC20.new(
          'Reward2',
          'Reward2',
          ONE_HUNDRED_THOUSAND_TOKENS,
          {from: project2Admin}
        )

        this.currentBlock = await time.latestBlock();
        this.stakingEndBlockProject2 = this.currentBlock.add(toBn('25'))
        this.pledgeFundingEndBlockProject2 = this.stakingEndBlockProject2.add(toBn('10'))
        this.project2TargetRaise = ether('100')

        await this.fundRaising.add(
          this.rewardToken2.address,
          this.stakingEndBlockProject2,
          this.pledgeFundingEndBlockProject2,
          this.project2TargetRaise,
          project2Admin,
          false,
          {from: deployer}
        )
      })

      it('Can fund the second project whilst users draw down from the first', async () => {
        // let daniel and ed pledge funding by staking LPOOL
        await pledge(POOL_ONE, ONE_THOUSAND_TOKENS.divn(2), daniel) // Daniel will have to fund 1/2 of the target raise
        await pledge(POOL_ONE, ONE_THOUSAND_TOKENS.divn(2), ed) // Ed will have to fund 1/2

        // move past staking end
        await time.advanceBlockTo(this.stakingEndBlockProject2.add(toBn('1')))

        // fund the pledge
        await fundPledge(POOL_ONE, daniel)
        await fundPledge(POOL_ONE, ed)

        // move past funding period
        const _1BlockPastFundingEndBlock = this.pledgeFundingEndBlockProject2.add(toBn('1'))
        await time.advanceBlockTo(_1BlockPastFundingEndBlock);

        // Project admin sends the rewards tokens in relation to raise
        await setupVestingRewards(
          POOL_ONE,
          this.rewardToken2,
          ONE_HUNDRED_THOUSAND_TOKENS,
          _1BlockPastFundingEndBlock.add(toBn('100')), // 1k tokens a block
          this.pledgeFundingEndBlockProject2,
          project2Admin
        )

        // rewards will come through after a few blocks
        const poolInfoAfterSettingUpRewards = await this.fundRaising.poolInfo(POOL_ONE);
        await time.advanceBlockTo(poolInfoAfterSettingUpRewards.lastRewardBlock.addn(4));

        // 5 blocks of rewards should be available
        await this.fundRaising.claimReward(POOL_ONE, {from: daniel})

        const totalRewardsForDanielAndEdAfter5Blocks = poolInfoAfterSettingUpRewards.rewardPerBlock.muln(5)
        const totalRewardsDaniel = totalRewardsForDanielAndEdAfter5Blocks.divn(2)

        const danielRewardTokenBalAfterClaim = await this.rewardToken2.balanceOf(daniel)

        shouldBeNumberInEtherCloseTo(danielRewardTokenBalAfterClaim, fromWei(totalRewardsDaniel))

        const aliceRewardTokenBalBeforeClaim = await this.rewardToken1.balanceOf(alice)

        // Alice claims rewards from pool zero
        await this.fundRaising.claimReward(POOL_ZERO, {from: alice})

        this.currentBlock = await time.latestBlock()
        const numBlocksSinceLastPoolZeroClaim = this.currentBlock.sub(this.lastClaimPoolZeroBlockNumber)

        const poolZeroInfo = await this.fundRaising.poolInfo(POOL_ZERO)

        const rewardsAvailableForAliceAndBobSinceLastClaim = poolZeroInfo.rewardPerBlock.mul(numBlocksSinceLastPoolZeroClaim)

        const totalRewardsAlice = rewardsAvailableForAliceAndBobSinceLastClaim.muln(2).divn(3) // alice gets 2/3 of rewards

        const aliceRewardTokenBalAfterClaim = await this.rewardToken1.balanceOf(alice)

        shouldBeNumberInEtherCloseTo(aliceRewardTokenBalAfterClaim.sub(aliceRewardTokenBalBeforeClaim), fromWei(totalRewardsAlice))
      })
    })
  })
})
