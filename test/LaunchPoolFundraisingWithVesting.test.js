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

  const txFee = ({gasUsed}) => {
    return toBn(gasUsed).mul(toBn(8000000000))
  }

  const ZERO = to18DP('0');
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
    const totalStakedBefore = await this.fundRaising.poolIdToTotalStaked(poolId)

    await this.launchPoolToken.approve(this.fundRaising.address, amount, {from: sender})
    const {receipt} = await this.fundRaising.pledge(poolId, amount, {from: sender})

    await expectEvent(receipt, 'Pledge', {
      user: sender,
      pid: poolId,
      amount
    })

    const {amount: pledgedAmount} = await this.fundRaising.userInfo(poolId, sender)
    expect(pledgedAmount).to.be.bignumber.equal(amount)

    const totalStakedAfter = await this.fundRaising.poolIdToTotalStaked(poolId)
    expect(totalStakedAfter.sub(totalStakedBefore)).to.be.bignumber.equal(amount)
  }

  const fundPledge = async (poolId, sender) => {
    const totalRaisedBefore = await this.fundRaising.poolIdToTotalRaised(poolId)
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

    const totalRaisedAfter = await this.fundRaising.poolIdToTotalRaised(poolId)
    expect(totalRaisedAfter.sub(totalRaisedBefore)).to.be.bignumber.equal(pledgeFundingAmount)
    expect(await contractEthBalance.delta()).to.be.bignumber.equal(pledgeFundingAmount)
  }

  const setupVestingRewards = async (poolId, rewardToken, rewardAmount, rewardStartBlock, rewardCliffEndBlock, rewardEndBlock, sender) => {
    await rewardToken.approve(this.fundRaising.address, rewardAmount, {from: sender})

    const guildTokenBalBefore = await rewardToken.balanceOf(this.guildBankAddress)

    const {receipt} = await this.fundRaising.setupVestingRewards(
      poolId,
      rewardAmount,
      rewardStartBlock,
      rewardCliffEndBlock,
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

    const maxRewardTokenAvailableForVesting = await this.fundRaising.poolIdToMaxRewardTokensAvailableForVesting(poolId)
    const rewardPerBlock = await this.fundRaising.poolIdToRewardPerBlock(poolId)
    const lastRewardBlock = await this.fundRaising.poolIdToLastRewardBlock(poolId)
    const rewardEndBlockFromPoolInfo = await this.fundRaising.poolIdToRewardEndBlock(poolId)

    expect(maxRewardTokenAvailableForVesting).to.be.bignumber.equal(rewardAmount)
    expect(lastRewardBlock).to.be.bignumber.equal(rewardStartBlock)
    expect(rewardEndBlockFromPoolInfo).to.be.bignumber.equal(rewardEndBlock)
    expect(rewardPerBlock).to.be.bignumber.equal(maxRewardTokenAvailableForVesting.div(rewardEndBlock.sub(rewardStartBlock)))
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

  it('Deployment reverts when staking token is zero', async () => {
    await expectRevert(
      LaunchPoolFundRaisingWithVesting.new(
        constants.ZERO_ADDRESS,
        {from: deployer}
      ),
      "constructor: _stakingToken must not be zero address"
    )
  })

  describe.only('Fund raising end to end flow', () => {
    describe('With 1 pool set up', () => {
      beforeEach(async () => {
        this.currentBlock = await time.latestBlock();

        // create reward token for fund raising
        this.rewardToken1 = await MockERC20.new(
          'Reward1',
          'Reward1',
          ONE_HUNDRED_THOUSAND_TOKENS,
          {from: project1Admin}
        )

        this.stakingEndBlock = this.currentBlock.add(toBn('110'))
        this.pledgeFundingEndBlock = this.stakingEndBlock.add(toBn('50'))
        this.project1TargetRaise = ether('100')

        await this.fundRaising.add(
          this.rewardToken1.address,
          this.currentBlock.add(toBn('10')),
          this.stakingEndBlock,
          this.pledgeFundingEndBlock,
          this.project1TargetRaise,
          project1Admin,
          TEN_MILLION_TOKENS,
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
          _1BlockPastFundingEndBlock.add(toBn('5')),
          _1BlockPastFundingEndBlock.add(toBn('5')),
          _1BlockPastFundingEndBlock.add(toBn('105')), // 1k tokens a block
          project1Admin
        )

        // rewards will come through after a few blocks
        const lastRewardBlockAfterSettingUpRewards = await this.fundRaising.poolIdToLastRewardBlock(POOL_ZERO);
        await time.advanceBlockTo(lastRewardBlockAfterSettingUpRewards.addn(4));

        // 5 blocks of rewards should be available
        await this.fundRaising.claimReward(POOL_ZERO, {from: alice})

        const poolIdToRewardPerBlock = await this.fundRaising.poolIdToRewardPerBlock(POOL_ZERO)
        const totalRewardsForAliceAndBobAfter5Blocks = poolIdToRewardPerBlock.muln(5)
        const totalRewardsAlice = totalRewardsForAliceAndBobAfter5Blocks.muln(2).divn(3) // alice gets 2/3

        const aliceRewardTokenBalAfterClaim = await this.rewardToken1.balanceOf(alice)

        shouldBeNumberInEtherCloseTo(aliceRewardTokenBalAfterClaim, fromWei(totalRewardsAlice))

        // bob claims after 6 blocks
        const totalRewardsForAliceAndBobAfter6Blocks = poolIdToRewardPerBlock.muln(6)
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
          this.currentBlock.add(toBn('10')),
          this.stakingEndBlock,
          this.pledgeFundingEndBlock,
          this.project1TargetRaise,
          project1Admin,
          TEN_MILLION_TOKENS,
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
          _1BlockPastFundingEndBlock.add(toBn('5')),
          _1BlockPastFundingEndBlock.add(toBn('5')),
          _1BlockPastFundingEndBlock.add(toBn('105')), // 1k tokens a block
          project1Admin
        )

        // rewards will come through after a few blocks
        const poolIdToLastRewardBlock = await this.fundRaising.poolIdToLastRewardBlock(POOL_ZERO);
        await time.advanceBlockTo(poolIdToLastRewardBlock.addn(4));

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
          this.currentBlock.add(toBn('5')),
          this.stakingEndBlockProject2,
          this.pledgeFundingEndBlockProject2,
          this.project2TargetRaise,
          project2Admin,
          TEN_MILLION_TOKENS,
          true,
          {from: deployer}
        )

        expect(await this.fundRaising.numberOfPools()).to.be.bignumber.equal('2')
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
          _1BlockPastFundingEndBlock.add(toBn('5')),
          _1BlockPastFundingEndBlock.add(toBn('5')),
          _1BlockPastFundingEndBlock.add(toBn('105')), // 1k tokens a block
          project2Admin
        )

        // rewards will come through after a few blocks
        const lastRewardBlockAfterSettingUpRewards = await this.fundRaising.poolIdToLastRewardBlock(POOL_ONE);
        await time.advanceBlockTo(lastRewardBlockAfterSettingUpRewards.addn(4));

        const rewardPerBlock = await this.fundRaising.poolIdToRewardPerBlock(POOL_ONE);
        const totalRewardsForDanielAndEdAfter4Blocks = rewardPerBlock.muln(4)
        const totalRewardsDanielPreClaim = totalRewardsForDanielAndEdAfter4Blocks.divn(2)

        const pendingRewards = await this.fundRaising.pendingRewards(POOL_ONE, daniel)
        shouldBeNumberInEtherCloseTo(pendingRewards, fromWei(totalRewardsDanielPreClaim))

        const totalRewardsForDanielAndEdAfter5Blocks = rewardPerBlock.muln(5)
        const totalRewardsDaniel = totalRewardsForDanielAndEdAfter5Blocks.divn(2)

        // 5 blocks of rewards should be available
        await this.fundRaising.claimReward(POOL_ONE, {from: daniel})

        const danielRewardTokenBalAfterClaim = await this.rewardToken2.balanceOf(daniel)

        shouldBeNumberInEtherCloseTo(danielRewardTokenBalAfterClaim, fromWei(totalRewardsDaniel))

        const aliceRewardTokenBalBeforeClaim = await this.rewardToken1.balanceOf(alice)

        // Alice claims rewards from pool zero
        await this.fundRaising.claimReward(POOL_ZERO, {from: alice})

        this.currentBlock = await time.latestBlock()
        const numBlocksSinceLastPoolZeroClaim = this.currentBlock.sub(this.lastClaimPoolZeroBlockNumber)

        const poolZeroRewardPerBlock = await this.fundRaising.poolIdToRewardPerBlock(POOL_ZERO)

        const rewardsAvailableForAliceAndBobSinceLastClaim = poolZeroRewardPerBlock.mul(numBlocksSinceLastPoolZeroClaim)

        const totalRewardsAlice = rewardsAvailableForAliceAndBobSinceLastClaim.muln(2).divn(3) // alice gets 2/3 of rewards

        const aliceRewardTokenBalAfterClaim = await this.rewardToken1.balanceOf(alice)

        shouldBeNumberInEtherCloseTo(aliceRewardTokenBalAfterClaim.sub(aliceRewardTokenBalBeforeClaim), fromWei(totalRewardsAlice))

        // update all the pools and there should be more rewards
        await this.fundRaising.massUpdatePools()

        const pendingRewardsAlice = await this.fundRaising.pendingRewards(POOL_ZERO, alice)
        const expectedRewards = poolZeroRewardPerBlock.muln(2).divn(3) // alice gets 2/3 of rewards
        shouldBeNumberInEtherCloseTo(pendingRewardsAlice, fromWei(expectedRewards))
      })
    })

    describe('When multiple pools are set up with same reward token (all in flight)', () => {
      beforeEach(async () => {
        this.currentBlock = await time.latestBlock();

        // create reward token for fund raising
        this.rewardToken1 = await MockERC20.new(
          'Reward1',
          'Reward1',
          ONE_HUNDRED_THOUSAND_TOKENS.muln(2),
          {from: project1Admin}
        )

        // send project admin 2 100k tokens from token 1
        await this.rewardToken1.transfer(project2Admin, ONE_HUNDRED_THOUSAND_TOKENS, {from: project1Admin})

        this.stakingEndBlock = this.currentBlock.add(toBn('100'))
        this.pledgeFundingEndBlock = this.stakingEndBlock.add(toBn('50'))
        this.project1TargetRaise = ether('100')

        await this.fundRaising.add(
          this.rewardToken1.address,
          this.currentBlock.add(toBn('10')),
          this.stakingEndBlock,
          this.pledgeFundingEndBlock,
          this.project1TargetRaise,
          project1Admin,
          TEN_MILLION_TOKENS,
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
          _1BlockPastFundingEndBlock.add(toBn('5')),
          _1BlockPastFundingEndBlock.add(toBn('5')),
          _1BlockPastFundingEndBlock.add(toBn('105')), // 1k tokens a block
          project1Admin
        )

        // rewards will come through after a few blocks
        const poolIdToLastRewardBlock = await this.fundRaising.poolIdToLastRewardBlock(POOL_ZERO);
        await time.advanceBlockTo(poolIdToLastRewardBlock.addn(4));

        // alice and bob claim their first few blocks of rewards
        await this.fundRaising.claimReward(POOL_ZERO, {from: alice})

        this.lastClaimPoolZeroBlockNumber = await time.latestBlock();

        await this.fundRaising.claimReward(POOL_ZERO, {from: bob})

        // use the same reward token for second project
        this.currentBlock = await time.latestBlock();
        this.stakingEndBlockProject2 = this.currentBlock.add(toBn('25'))
        this.pledgeFundingEndBlockProject2 = this.stakingEndBlockProject2.add(toBn('10'))
        this.project2TargetRaise = ether('100')

        await this.fundRaising.add(
          this.rewardToken1.address,
          this.currentBlock.add(toBn('5')),
          this.stakingEndBlockProject2,
          this.pledgeFundingEndBlockProject2,
          this.project2TargetRaise,
          project2Admin,
          TEN_MILLION_TOKENS,
          true,
          {from: deployer}
        )

        expect(await this.fundRaising.numberOfPools()).to.be.bignumber.equal('2')
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
          this.rewardToken1,
          ONE_HUNDRED_THOUSAND_TOKENS,
          _1BlockPastFundingEndBlock.add(toBn('5')),
          _1BlockPastFundingEndBlock.add(toBn('5')),
          _1BlockPastFundingEndBlock.add(toBn('105')), // 1k tokens a block
          project2Admin
        )

        // rewards will come through after a few blocks
        const lastRewardBlockAfterSettingUpRewards = await this.fundRaising.poolIdToLastRewardBlock(POOL_ONE);
        await time.advanceBlockTo(lastRewardBlockAfterSettingUpRewards.addn(4));

        const rewardPerBlock = await this.fundRaising.poolIdToRewardPerBlock(POOL_ONE);
        const totalRewardsForDanielAndEdAfter4Blocks = rewardPerBlock.muln(4)
        const totalRewardsDanielPreClaim = totalRewardsForDanielAndEdAfter4Blocks.divn(2)

        const pendingRewards = await this.fundRaising.pendingRewards(POOL_ONE, daniel)
        shouldBeNumberInEtherCloseTo(pendingRewards, fromWei(totalRewardsDanielPreClaim))

        const totalRewardsForDanielAndEdAfter5Blocks = rewardPerBlock.muln(5)
        const totalRewardsDaniel = totalRewardsForDanielAndEdAfter5Blocks.divn(2)

        // 5 blocks of rewards should be available
        await this.fundRaising.claimReward(POOL_ONE, {from: daniel})

        const danielRewardTokenBalAfterClaim = await this.rewardToken1.balanceOf(daniel)

        shouldBeNumberInEtherCloseTo(danielRewardTokenBalAfterClaim, fromWei(totalRewardsDaniel))

        const aliceRewardTokenBalBeforeClaim = await this.rewardToken1.balanceOf(alice)

        // Alice claims rewards from pool zero
        await this.fundRaising.claimReward(POOL_ZERO, {from: alice})

        this.currentBlock = await time.latestBlock()
        const numBlocksSinceLastPoolZeroClaim = this.currentBlock.sub(this.lastClaimPoolZeroBlockNumber)

        const poolZeroRewardPerBlock = await this.fundRaising.poolIdToRewardPerBlock(POOL_ZERO)

        const rewardsAvailableForAliceAndBobSinceLastClaim = poolZeroRewardPerBlock.mul(numBlocksSinceLastPoolZeroClaim)

        const totalRewardsAlice = rewardsAvailableForAliceAndBobSinceLastClaim.muln(2).divn(3) // alice gets 2/3 of rewards

        const aliceRewardTokenBalAfterClaim = await this.rewardToken1.balanceOf(alice)

        shouldBeNumberInEtherCloseTo(aliceRewardTokenBalAfterClaim.sub(aliceRewardTokenBalBeforeClaim), fromWei(totalRewardsAlice))

        // update all the pools and there should be more rewards
        await this.fundRaising.massUpdatePools()

        const pendingRewardsAlice = await this.fundRaising.pendingRewards(POOL_ZERO, alice)
        const expectedRewards = poolZeroRewardPerBlock.muln(2).divn(3) // alice gets 2/3 of rewards
        shouldBeNumberInEtherCloseTo(pendingRewardsAlice, fromWei(expectedRewards))
      })
    })

    describe('When multiple pools are set up with same reward token (one ended, one active)', () => {
      beforeEach(async () => {
        this.currentBlock = await time.latestBlock();

        // create reward token for fund raising
        this.rewardToken1 = await MockERC20.new(
          'Reward1',
          'Reward1',
          ONE_HUNDRED_THOUSAND_TOKENS.muln(2),
          {from: project1Admin}
        )

        // send project admin 2 100k tokens from token 1
        await this.rewardToken1.transfer(project2Admin, ONE_HUNDRED_THOUSAND_TOKENS, {from: project1Admin})

        this.stakingEndBlock = this.currentBlock.add(toBn('100'))
        this.pledgeFundingEndBlock = this.stakingEndBlock.add(toBn('50'))
        this.project1TargetRaise = ether('100')

        await this.fundRaising.add(
          this.rewardToken1.address,
          this.currentBlock.add(toBn('10')),
          this.stakingEndBlock,
          this.pledgeFundingEndBlock,
          this.project1TargetRaise,
          project1Admin,
          TEN_MILLION_TOKENS,
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
        const project1RewardEndBlock = _1BlockPastFundingEndBlock.add(toBn('105'))
        await setupVestingRewards(
          POOL_ZERO,
          this.rewardToken1,
          ONE_HUNDRED_THOUSAND_TOKENS,
          _1BlockPastFundingEndBlock.add(toBn('5')),
          _1BlockPastFundingEndBlock.add(toBn('5')),
          project1RewardEndBlock, // 1k tokens a block
          project1Admin
        )

        // rewards will come through after a few blocks
        const poolIdToLastRewardBlock = await this.fundRaising.poolIdToLastRewardBlock(POOL_ZERO);
        await time.advanceBlockTo(poolIdToLastRewardBlock.addn(4));

        // alice and bob claim their first few blocks of rewards
        await this.fundRaising.claimReward(POOL_ZERO, {from: alice})

        this.lastClaimPoolZeroBlockNumber = await time.latestBlock();

        await this.fundRaising.claimReward(POOL_ZERO, {from: bob})

        await time.advanceBlockTo(project1RewardEndBlock.addn(1));

        await this.fundRaising.claimReward(POOL_ZERO, {from: alice})
        await this.fundRaising.claimReward(POOL_ZERO, {from: bob})

        expect(await this.fundRaising.pendingRewards(POOL_ZERO, alice)).to.be.bignumber.equal('0')
        expect(await this.fundRaising.pendingRewards(POOL_ZERO, bob)).to.be.bignumber.equal('0')

        // use the same reward token for second project
        this.currentBlock = await time.latestBlock();
        this.stakingEndBlockProject2 = this.currentBlock.add(toBn('25'))
        this.pledgeFundingEndBlockProject2 = this.stakingEndBlockProject2.add(toBn('10'))
        this.project2TargetRaise = ether('100')

        await this.fundRaising.add(
          this.rewardToken1.address,
          this.currentBlock.add(toBn('5')),
          this.stakingEndBlockProject2,
          this.pledgeFundingEndBlockProject2,
          this.project2TargetRaise,
          project2Admin,
          TEN_MILLION_TOKENS,
          true,
          {from: deployer}
        )

        expect(await this.fundRaising.numberOfPools()).to.be.bignumber.equal('2')
      })

      it('Can fund the second project but stakers from first cannot withdraw', async () => {
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
          this.rewardToken1,
          ONE_HUNDRED_THOUSAND_TOKENS,
          _1BlockPastFundingEndBlock.add(toBn('5')),
          _1BlockPastFundingEndBlock.add(toBn('5')),
          _1BlockPastFundingEndBlock.add(toBn('105')), // 1k tokens a block
          project2Admin
        )

        // rewards will come through after a few blocks
        const lastRewardBlockAfterSettingUpRewards = await this.fundRaising.poolIdToLastRewardBlock(POOL_ONE);
        await time.advanceBlockTo(lastRewardBlockAfterSettingUpRewards.addn(4));

        const rewardPerBlock = await this.fundRaising.poolIdToRewardPerBlock(POOL_ONE);
        const totalRewardsForDanielAndEdAfter4Blocks = rewardPerBlock.muln(4)
        const totalRewardsDanielPreClaim = totalRewardsForDanielAndEdAfter4Blocks.divn(2)

        const pendingRewards = await this.fundRaising.pendingRewards(POOL_ONE, daniel)
        shouldBeNumberInEtherCloseTo(pendingRewards, fromWei(totalRewardsDanielPreClaim))

        const totalRewardsForDanielAndEdAfter5Blocks = rewardPerBlock.muln(5)
        const totalRewardsDaniel = totalRewardsForDanielAndEdAfter5Blocks.divn(2)

        // 5 blocks of rewards should be available
        await this.fundRaising.claimReward(POOL_ONE, {from: daniel})

        const danielRewardTokenBalAfterClaim = await this.rewardToken1.balanceOf(daniel)

        shouldBeNumberInEtherCloseTo(danielRewardTokenBalAfterClaim, fromWei(totalRewardsDaniel))

        const aliceRewardTokenBalBeforeClaim = await this.rewardToken1.balanceOf(alice)

        // Alice claims rewards from pool zero
        await this.fundRaising.claimReward(POOL_ZERO, {from: alice})

        this.currentBlock = await time.latestBlock()
        const numBlocksSinceLastPoolZeroClaim = this.currentBlock.sub(this.lastClaimPoolZeroBlockNumber)

        const poolZeroRewardPerBlock = await this.fundRaising.poolIdToRewardPerBlock(POOL_ZERO)

        const rewardsAvailableForAliceAndBobSinceLastClaim = poolZeroRewardPerBlock.mul(numBlocksSinceLastPoolZeroClaim)

        const aliceRewardTokenBalAfterClaim = await this.rewardToken1.balanceOf(alice)

        shouldBeNumberInEtherCloseTo(aliceRewardTokenBalAfterClaim.sub(aliceRewardTokenBalBeforeClaim), '0')

        // update all the pools and there should be more rewards
        await this.fundRaising.massUpdatePools()

        const pendingRewardsAlice = await this.fundRaising.pendingRewards(POOL_ZERO, alice)
        shouldBeNumberInEtherCloseTo(pendingRewardsAlice, '0')
      })
    })
  })

  describe.only('add()', () => {
    it('Reverts when reward token is zero address', async () => {
      await expectRevert(
        this.fundRaising.add(
          constants.ZERO_ADDRESS,
          0,
          1,
          2,
          3,
          project1Admin,
          TEN_MILLION_TOKENS,
          false
        ),
        "add: _rewardToken is zero address"
      )
    })

    it('Reverts when staking end block is after pledge funding end block', async () => {
      await expectRevert(
        this.fundRaising.add(
          this.launchPoolToken.address,
          0,
          2,
          1,
          1,
          project1Admin,
          TEN_MILLION_TOKENS,
          false
        ),
        "add: staking end must be before funding end"
      )
    })

    it('Reverts when target raise is zero', async () => {
      await expectRevert(
        this.fundRaising.add(
          this.launchPoolToken.address,
          0,
          1,
          2,
          0,
          project1Admin,
          TEN_MILLION_TOKENS,
          false
        ),
        "add: Invalid raise amount"
      )
    })

    it('Reverts when fund raising recipient is address zero', async () => {
      await expectRevert(
        this.fundRaising.add(
          this.launchPoolToken.address,
          0,
          1,
          2,
          1,
          constants.ZERO_ADDRESS,
          TEN_MILLION_TOKENS,
          false
        ),
        "add: _fundRaisingRecipient is zero address"
      )
    })

    it('Reverts when token allocation block is after staking end', async () => {
      await expectRevert(
        this.fundRaising.add(
          this.launchPoolToken.address,
          4,
          1,
          2,
          1,
          constants.ZERO_ADDRESS,
          TEN_MILLION_TOKENS,
          false
        ),
        "add: _tokenAllocationStartBlock must be before staking end"
      )
    })
  })

  describe.only('pledge()', () => {
    it('Reverts when invalid PID', async () => {
      await expectRevert(
        this.fundRaising.pledge('99', '1'),
        "pledge: Invalid PID"
      )
    })

    it('Reverts when amount is zero', async () => {
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
        this.currentBlock.add(toBn('10')),
        this.stakingEndBlock,
        this.pledgeFundingEndBlock,
        this.project1TargetRaise,
        project1Admin,
        TEN_MILLION_TOKENS,
        false,
        {from: deployer}
      )

      await expectRevert(
        this.fundRaising.pledge(POOL_ZERO, '0'),
        "pledge: No pledge specified"
      )
    })

    it('Reverts when staking after staking end block', async () => {
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
        this.currentBlock.add(toBn('10')),
        this.stakingEndBlock,
        this.pledgeFundingEndBlock,
        this.project1TargetRaise,
        project1Admin,
        TEN_MILLION_TOKENS,
        false,
        {from: deployer}
      )

      const _1BlockPastFundingEndBlock = this.pledgeFundingEndBlock.add(toBn('1'))
      await time.advanceBlockTo(_1BlockPastFundingEndBlock);

      await expectRevert(
        this.fundRaising.pledge(POOL_ZERO, '1'),
        "pledge: Staking no longer permitted"
      )
    })

    it('Reverts when trying to exceed the max staking per user', async () => {
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
        this.currentBlock.add(toBn('10')),
        this.stakingEndBlock,
        this.pledgeFundingEndBlock,
        this.project1TargetRaise,
        project1Admin,
        TEN_MILLION_TOKENS,
        false,
        {from: deployer}
      )

      await expectRevert(
        pledge(POOL_ZERO, TEN_MILLION_TOKENS.addn(1), alice),
        "pledge: can not exceed max staking amount per user"
      )
    })
  })

  describe.only('getPledgeFundingAmount()', () => {
    it('Reverts when pid is invalid', async () => {
      await expectRevert(
        this.fundRaising.getPledgeFundingAmount('9999'),
        "getPledgeFundingAmount: Invalid PID"
      )
    })
  })

  describe.only('fundPledge()', () => {
    it('Reverts when invalid PID', async () => {
      await expectRevert(
        this.fundRaising.fundPledge('99'),
        "fundPledge: Invalid PID"
      )
    })

    it('Reverts when pledge has already been funded', async () => {
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
        this.currentBlock.add(toBn('10')),
        this.stakingEndBlock,
        this.pledgeFundingEndBlock,
        this.project1TargetRaise,
        project1Admin,
        TEN_MILLION_TOKENS,
        false,
        {from: deployer}
      )

      await pledge(POOL_ZERO, ONE_THOUSAND_TOKENS, alice)

      await time.advanceBlockTo(this.stakingEndBlock.add(toBn('1')))

      // fund the pledge
      await fundPledge(POOL_ZERO, alice)

      await expectRevert(
        this.fundRaising.fundPledge(POOL_ZERO, {from: alice}),
        "fundPledge: Pledge has already been funded"
      )
    })

    it('Reverts when staking is still taking place', async () => {
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
        this.currentBlock.add(toBn('10')),
        this.stakingEndBlock,
        this.pledgeFundingEndBlock,
        this.project1TargetRaise,
        project1Admin,
        TEN_MILLION_TOKENS,
        false,
        {from: deployer}
      )

      await expectRevert(
        this.fundRaising.fundPledge(POOL_ZERO, {from: alice}),
        "fundPledge: Staking is still taking place"
      )
    })

    it('Reverts when deadline for funding a pledge has passed', async () => {
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
        this.currentBlock.add(toBn('10')),
        this.stakingEndBlock,
        this.pledgeFundingEndBlock,
        this.project1TargetRaise,
        project1Admin,
        TEN_MILLION_TOKENS,
        false,
        {from: deployer}
      )

      await time.advanceBlockTo(this.pledgeFundingEndBlock.add(toBn('1')))

      await expectRevert(
        this.fundRaising.fundPledge(POOL_ZERO, {from: alice}),
        "fundPledge: Deadline has passed to fund your pledge"
      )
    })

    it('Reverts when invalid eth amount sent', async () => {
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
        this.currentBlock.add(toBn('10')),
        this.stakingEndBlock,
        this.pledgeFundingEndBlock,
        this.project1TargetRaise,
        project1Admin,
        TEN_MILLION_TOKENS,
        false,
        {from: deployer}
      )

      await pledge(POOL_ZERO, ONE_THOUSAND_TOKENS, alice)

      await time.advanceBlockTo(this.stakingEndBlock.add(toBn('1')))

      await expectRevert(
        this.fundRaising.fundPledge(POOL_ZERO, {from: alice, value: '5'}),
        "fundPledge: Required ETH amount not satisfied"
      )
    })

    it('Reverts when user has not staked', async () => {
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
        this.currentBlock.add(toBn('10')),
        this.stakingEndBlock,
        this.pledgeFundingEndBlock,
        this.project1TargetRaise,
        project1Admin,
        TEN_MILLION_TOKENS,
        false,
        {from: deployer}
      )

      await time.advanceBlockTo(this.stakingEndBlock.add(toBn('1')))

      await expectRevert(
        this.fundRaising.fundPledge(POOL_ZERO, {from: alice, value: '5'}),
        "fundPledge: Must have staked"
      )
    })
  })

  describe.only('setupVestingRewards()', () => {
    it('Reverts when invalid PID', async () => {
      await expectRevert(
        this.fundRaising.setupVestingRewards('999', '2', '3', '4', '5'),
        "setupVestingRewards: Invalid PID"
      )
    })

    describe('with pool that is set up', () => {
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
          this.currentBlock.add(toBn('10')),
          this.stakingEndBlock,
          this.pledgeFundingEndBlock,
          this.project1TargetRaise,
          project1Admin,
          TEN_MILLION_TOKENS,
          false,
          {from: deployer}
        )
      })

      it('Reverts when start block is in the past', async () => {
        await expectRevert(
          this.fundRaising.setupVestingRewards(POOL_ZERO, ONE_THOUSAND_TOKENS, 0, 0, 0),
          "setupVestingRewards: start block in the past"
        )
      })

      it('Reverts when cliff block is not at least eq start block', async () => {
        this.currentBlock = await time.latestBlock();
        const rewardStart = this.currentBlock.add(toBn('200'))
        const rewardCliff = this.currentBlock.add(toBn('199'))
        const rewardEnd = this.currentBlock.add(toBn('300'))

        await expectRevert(
          this.fundRaising.setupVestingRewards(POOL_ZERO, ONE_THOUSAND_TOKENS, rewardStart, rewardCliff, rewardEnd),
          "setupVestingRewards: Cliff must be after or equal to start block"
        )
      })

      it('Reverts when reward end block before cliff end', async () => {
        this.currentBlock = await time.latestBlock();
        const rewardStart = this.currentBlock.add(toBn('200'))
        const rewardCliff = this.currentBlock.add(toBn('250'))
        const rewardEnd = this.currentBlock.add(toBn('210'))

        await expectRevert(
          this.fundRaising.setupVestingRewards(POOL_ZERO, '2', rewardStart, rewardCliff, rewardEnd),
          "setupVestingRewards: end block must be after cliff block"
        )
      })

      it('Reverts when stakers are still pledging', async () => {
        this.currentBlock = await time.latestBlock();
        const rewardStart = this.currentBlock.add(toBn('200'))
        const rewardCliff = this.currentBlock.add(toBn('250'))
        const rewardEnd = this.currentBlock.add(toBn('500'))

        await expectRevert(
          this.fundRaising.setupVestingRewards(POOL_ZERO, ONE_HUNDRED_THOUSAND_TOKENS, rewardStart, rewardCliff, rewardEnd),
          "setupVestingRewards: Stakers are still pledging"
        )
      })

      it('Reverts when not fund raising recipient', async () => {
        this.currentBlock = await time.latestBlock();
        const rewardStart = this.currentBlock.add(toBn('200'))
        const rewardCliff = this.currentBlock.add(toBn('250'))
        const rewardEnd = this.currentBlock.add(toBn('500'))

        await time.advanceBlockTo(this.pledgeFundingEndBlock.add(toBn('2')))

        await expectRevert(
          this.fundRaising.setupVestingRewards(POOL_ZERO, ONE_HUNDRED_THOUSAND_TOKENS, rewardStart, rewardCliff, rewardEnd, {from: daniel}),
          "setupVestingRewards: Only fund raising recipient"
        )
      })
    })
  })

  describe.only('pendingRewards()', () => {
    it('Returns zero when user has not funded a pledge', async () => {
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
        this.currentBlock.add(toBn('10')),
        this.stakingEndBlock,
        this.pledgeFundingEndBlock,
        this.project1TargetRaise,
        project1Admin,
        TEN_MILLION_TOKENS,
        false,
        {from: deployer}
      )

      const pendingRewards = await this.fundRaising.pendingRewards(POOL_ZERO, alice)
      expect(pendingRewards).to.be.bignumber.equal('0')
    })
  })

  describe.only('claimReward()', () => {
    beforeEach(async () => {
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
        this.currentBlock.add(toBn('10')),
        this.stakingEndBlock,
        this.pledgeFundingEndBlock,
        this.project1TargetRaise,
        project1Admin,
        TEN_MILLION_TOKENS,
        false,
        {from: deployer}
      )
    })

    it('Reverts when user has not funded their pledge', async () => {
      await expectRevert(
        this.fundRaising.claimReward(POOL_ZERO),
        "claimReward: Nice try pal"
      )
    })

    it('Reverts when not passed cliff', async () => {
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
        _1BlockPastFundingEndBlock.add(toBn('5')),
        _1BlockPastFundingEndBlock.add(toBn('50')),
        _1BlockPastFundingEndBlock.add(toBn('105')), // 1k tokens a block
        project1Admin
      )

      await expectRevert(
        this.fundRaising.claimReward(POOL_ZERO, {from: alice}),
        "claimReward: Not past cliff"
      )

      // also pending rewards returns zero
      expect(await this.fundRaising.pendingRewards(POOL_ZERO, alice)).to.be.bignumber.equal('0')
    })

    it('When rewards have not been set up, no rewards issued', async () => {
      await pledge(POOL_ZERO, ONE_THOUSAND_TOKENS, alice)

      // move past staking end
      await time.advanceBlockTo(this.stakingEndBlock.add(toBn('1')))

      // fund the pledge
      await fundPledge(POOL_ZERO, alice)

      // move past funding period
      const _1BlockPastFundingEndBlock = this.pledgeFundingEndBlock.add(toBn('1'))
      await time.advanceBlockTo(_1BlockPastFundingEndBlock);

      const aliceRewardBalBefore = await this.rewardToken1.balanceOf(alice)

      await this.fundRaising.claimReward(POOL_ZERO, {from: alice})

      const aliceRewardBalAfter = await this.rewardToken1.balanceOf(alice)

      expect(aliceRewardBalAfter.sub(aliceRewardBalBefore)).to.be.bignumber.equal('0')
    })
  })

  describe.only('claimFundRaising()', () => {
    describe('When a project is fully funded', () => {
      beforeEach(async () => {
        // set up and fully fund a project
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
          this.currentBlock.add(toBn('10')),
          this.stakingEndBlock,
          this.pledgeFundingEndBlock,
          this.project1TargetRaise,
          project1Admin,
          TEN_MILLION_TOKENS,
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

        // ensure fund raising cannot be claimed before rewards are sent
        await expectRevert(
          this.fundRaising.claimFundRaising(POOL_ZERO, {from: project1Admin}),
          "claimFundRaising: rewards not yet sent"
        )

        // Project admin sends the rewards tokens in relation to raise
        await setupVestingRewards(
          POOL_ZERO,
          this.rewardToken1,
          ONE_HUNDRED_THOUSAND_TOKENS,
          _1BlockPastFundingEndBlock.add(toBn('5')),
          _1BlockPastFundingEndBlock.add(toBn('5')),
          _1BlockPastFundingEndBlock.add(toBn('105')), // 1k tokens a block
          project1Admin
        )
      })

      it('Can claim the raised funds', async () => {
        const project1AdminBalanceTracker = await balance.tracker(project1Admin)

        const {receipt} = await this.fundRaising.claimFundRaising(POOL_ZERO, {from: project1Admin})

        let {raised} = (await this.fundRaising.getTotalRaisedVsTarget(POOL_ZERO, {from: alice}))
        expect(await project1AdminBalanceTracker.delta()).to.be.bignumber.equal(raised.sub(txFee(receipt)))
      })

      it('Reverts when rewards have already been claimed', async () => {
        await this.fundRaising.claimFundRaising(POOL_ZERO, {from: project1Admin})
        await expectRevert(
          this.fundRaising.claimFundRaising(POOL_ZERO, {from: project1Admin}),
          "claimFundRaising: Already claimed funds"
        )
      })

      it('Reverts when sender is not the project admin', async () => {
        await expectRevert(
          this.fundRaising.claimFundRaising(POOL_ZERO, {from: bob}),
          "claimFundRaising: Only fundraising recipient"
        )
      })
    })

    it('Reverts when pid is invalid', async () => {
      await expectRevert(
        this.fundRaising.claimFundRaising('999'),
        "claimFundRaising: invalid _pid"
      )
    })
  })

  describe.only('withdraw', () => {
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
        this.currentBlock.add(toBn('10')),
        this.stakingEndBlock,
        this.pledgeFundingEndBlock,
        this.project1TargetRaise,
        project1Admin,
        TEN_MILLION_TOKENS,
        false,
        {from: deployer}
      )

      // let alice pledge funding by staking LPOOL
      await pledge(POOL_ZERO, ONE_THOUSAND_TOKENS, alice)
    })

    it('Can not withdraw if funded pledge after pledgeFundingEndBlock', async () => {
      await time.advanceBlockTo(this.stakingEndBlock.add(toBn('1')))

      // fund the pledge
      await fundPledge(POOL_ZERO, alice)

      // move past funding period
      const _1BlockPastFundingEndBlock = this.pledgeFundingEndBlock.add(toBn('1'))
      await time.advanceBlockTo(_1BlockPastFundingEndBlock);

      await expectRevert(
        this.fundRaising.withdraw(POOL_ZERO, {from: alice}),
        "withdraw: Only allow non-funders to withdraw"
      );
    })

    it('Can withdraw if not funded pledge after pledgeFundingEndBlock', async () => {
      // move past funding period
      const _1BlockPastFundingEndBlock = this.pledgeFundingEndBlock.add(toBn('1'))
      await time.advanceBlockTo(_1BlockPastFundingEndBlock);

      const aliceLpoolBalBefore = await this.launchPoolToken.balanceOf(alice)

      await this.fundRaising.withdraw(POOL_ZERO, {from: alice})

      const aliceLpoolBalAfter = await this.launchPoolToken.balanceOf(alice)

      expect(aliceLpoolBalAfter.sub(aliceLpoolBalBefore)).to.be.bignumber.equal(ONE_THOUSAND_TOKENS)
    })

    it('Reverts when withdrawing after staking', async () => {
      await expectRevert(
        this.fundRaising.withdraw(POOL_ZERO, {from: alice}),
        "withdraw: Not yet permitted"
      )
    })

    it('Reverts when withdrawing after staking ends but before end of pledge funding', async () => {
      await time.advanceBlockTo(this.stakingEndBlock.add(toBn('1')))
      await expectRevert(
        this.fundRaising.withdraw(POOL_ZERO, {from: alice}),
        "withdraw: Not yet permitted"
      )
    })

    it('Reverts when withdrawing twice', async () => {
      const _1BlockPastFundingEndBlock = this.pledgeFundingEndBlock.add(toBn('5'))
      await time.advanceBlockTo(_1BlockPastFundingEndBlock);

      await this.fundRaising.withdraw(POOL_ZERO, {from: alice})

      await expectRevert(
        this.fundRaising.withdraw(POOL_ZERO, {from: alice}),
        "withdraw: No stake to withdraw"
      )
    })

    it('Reverts when user has not staked', async () => {
      await expectRevert(
        this.fundRaising.withdraw(POOL_ZERO, {from: daniel}),
        "withdraw: No stake to withdraw"
      )
    })

    it('Reverts when pid is invalid', async () => {
      await expectRevert(
        this.fundRaising.withdraw('999'),
        "withdraw: invalid _pid"
      )
    })
  })
})
