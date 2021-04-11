const {time, BN, expectRevert, expectEvent, constants, ether, balance} = require('@openzeppelin/test-helpers');

const LaunchPoolToken = artifacts.require('LaunchPoolToken');
const LaunchPoolFundRaisingWithVesting = artifacts.require('LaunchPoolFundRaisingWithVesting');
const MockERC20 = artifacts.require('MockERC20');

require('chai').should();
const {expect} = require('chai');

const {fromWei} = require('web3-utils');

contract('LaunchPoolFundRaisingWithVesting USE CASES', ([
                                                          admin,
                                                          alice,
                                                          bob,
                                                          carol,
                                                          daniel,
                                                          ed,
                                                          whale,
                                                        ]) => {

  const shouldBeNumberInEtherCloseTo = (valInWei, expected) => parseFloat(fromWei(valInWei)).should.be.closeTo(parseFloat(expected.toString()), 0.001);

  const to18DP = (value) => {
    return new BN(value).mul(new BN('10').pow(new BN('18')));
  };

  const toBn = (value) => new BN(value);

  const txFee = ({gasUsed}) => {
    return toBn(gasUsed).mul(toBn(8000000000));
  };

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
    await this.launchPoolToken.transfer(whale, ONE_THOUSAND_TOKENS.muln(2), {from});
  };

  const pledge = async (poolId, amount, sender) => {
    const totalStakedBefore = await this.fundRaising.poolIdToTotalStaked(poolId);

    const userInfoBefore = await this.fundRaising.userInfo(poolId, sender);

    await this.launchPoolToken.approve(this.fundRaising.address, amount, {from: sender});
    const {receipt} = await this.fundRaising.pledge(poolId, amount, {from: sender});

    await expectEvent(receipt, 'Pledge', {
      user: sender,
      pid: poolId,
      amount
    });

    const {amount: pledgedAmount} = await this.fundRaising.userInfo(poolId, sender);
    expect(pledgedAmount).to.be.bignumber.equal(amount.add(userInfoBefore.amount));

    const totalStakedAfter = await this.fundRaising.poolIdToTotalStaked(poolId);
    expect(totalStakedAfter.sub(totalStakedBefore)).to.be.bignumber.equal(amount);
  };

  const fundPledge = async (poolId, sender) => {
    const totalRaisedBefore = await this.fundRaising.poolIdToTotalRaised(poolId);
    const contractEthBalance = await balance.tracker(this.fundRaising.address);

    const pledgeFundingAmount = await this.fundRaising.getPledgeFundingAmount(poolId, {from: sender});
    const {receipt} = await this.fundRaising.fundPledge(poolId, {from: sender, value: pledgeFundingAmount});

    await expectEvent(receipt, 'PledgeFunded', {
      user: sender,
      pid: poolId,
      amount: pledgeFundingAmount
    });

    const {pledgeFundingAmount: fundingCommited, amount} = await this.fundRaising.userInfo(poolId, sender);
    expect(fundingCommited).to.be.bignumber.equal(pledgeFundingAmount);

    const totalRaisedAfter = await this.fundRaising.poolIdToTotalRaised(poolId);
    expect(totalRaisedAfter.sub(totalRaisedBefore)).to.be.bignumber.equal(pledgeFundingAmount);
    expect(await contractEthBalance.delta()).to.be.bignumber.equal(pledgeFundingAmount);
  };

  const setupVestingRewards = async (poolId, rewardToken, rewardAmount, rewardStartBlock, rewardCliffEndBlock, rewardEndBlock, sender) => {
    await rewardToken.approve(this.fundRaising.address, rewardAmount, {from: sender});

    const guildTokenBalBefore = await rewardToken.balanceOf(this.guildBankAddress);

    const {receipt} = await this.fundRaising.setupVestingRewards(
      poolId,
      rewardAmount,
      rewardStartBlock,
      rewardCliffEndBlock,
      rewardEndBlock,
      {from: sender}
    );

    await expectEvent(receipt, 'RewardsSetUp', {
      pid: poolId,
      amount: rewardAmount,
      rewardEndBlock
    });

    const guildTokenBalAfter = await rewardToken.balanceOf(this.guildBankAddress);

    expect(guildTokenBalAfter.sub(guildTokenBalBefore)).to.be.bignumber.equal(rewardAmount);

    const maxRewardTokenAvailableForVesting = await this.fundRaising.poolIdToMaxRewardTokensAvailableForVesting(poolId);
    const rewardPerBlock = await this.fundRaising.poolIdToRewardPerBlock(poolId);
    const lastRewardBlock = await this.fundRaising.poolIdToLastRewardBlock(poolId);
    const rewardEndBlockFromPoolInfo = await this.fundRaising.poolIdToRewardEndBlock(poolId);

    expect(maxRewardTokenAvailableForVesting).to.be.bignumber.equal(rewardAmount);
    expect(lastRewardBlock).to.be.bignumber.equal(rewardStartBlock);
    expect(rewardEndBlockFromPoolInfo).to.be.bignumber.equal(rewardEndBlock);
    expect(rewardPerBlock).to.be.bignumber.equal(maxRewardTokenAvailableForVesting.div(rewardEndBlock.sub(rewardStartBlock)));
  };

  const POOL_ZERO = new BN('0');
  const POOL_ONE = new BN('1');

  beforeEach(async () => {
    this.launchPoolToken = await LaunchPoolToken.new(TEN_MILLION_TOKENS, admin, {from: admin});

    this.fundRaising = await LaunchPoolFundRaisingWithVesting.new(
      this.launchPoolToken.address,
      {from: admin}
    );

    this.guildBankAddress = await this.fundRaising.rewardGuildBank();

    await setupUsers(admin);

    this.currentBlock = await time.latestBlock();
  });

  describe.only('Fund raising end to end flow', () => {
    describe('With 1 pool set up', () => {
      beforeEach(async () => {
        this.currentBlock = await time.latestBlock();

        // create reward token for fund raising
        this.rewardToken1 = await MockERC20.new(
          'Reward1',
          'Reward1',
          ONE_HUNDRED_THOUSAND_TOKENS,
          {from: admin}
        );

        this.stakingEndBlock = this.currentBlock.add(toBn('50'));
        this.pledgeFundingEndBlock = this.stakingEndBlock.add(toBn('10'));
        this.project1TargetRaise = ether('100');

        await this.fundRaising.add(
          this.rewardToken1.address,
          this.currentBlock.add(toBn('10')),
          this.stakingEndBlock,
          this.pledgeFundingEndBlock,
          this.project1TargetRaise,
          TEN_MILLION_TOKENS,
          false,
          {from: admin}
        );
      });

      it('Can farm reward tokens once all stages have passed', async () => {
        // let alice and bob pledge funding by staking LPOOL
        await pledge(POOL_ZERO, ONE_THOUSAND_TOKENS, alice); // Alice will have to fund 2/3 of the target raise
        await pledge(POOL_ZERO, ONE_THOUSAND_TOKENS.divn(2), bob); // Bob will have to fund 1/3

        // move past staking end
        await time.advanceBlockTo(this.stakingEndBlock.add(toBn('1')));

        // fund the pledge
        await fundPledge(POOL_ZERO, alice);
        await fundPledge(POOL_ZERO, bob);

        // move past funding period
        const _1BlockPastFundingEndBlock = this.pledgeFundingEndBlock.add(toBn('1'));
        await time.advanceBlockTo(_1BlockPastFundingEndBlock);

        // 100% funding will have taken place
        const {raised, target} = await this.fundRaising.getTotalRaisedVsTarget(POOL_ZERO);
        shouldBeNumberInEtherCloseTo(raised, fromWei(target));

        // Project admin sends the rewards tokens in relation to raise
        await setupVestingRewards(
          POOL_ZERO,
          this.rewardToken1,
          ONE_HUNDRED_THOUSAND_TOKENS,
          _1BlockPastFundingEndBlock.add(toBn('5')),
          _1BlockPastFundingEndBlock.add(toBn('5')),
          _1BlockPastFundingEndBlock.add(toBn('105')), // 1k tokens a block
          admin
        );

        // rewards will come through after a few blocks
        const lastRewardBlockAfterSettingUpRewards = await this.fundRaising.poolIdToLastRewardBlock(POOL_ZERO);
        await time.advanceBlockTo(lastRewardBlockAfterSettingUpRewards.addn(4));

        // 5 blocks of rewards should be available
        await this.fundRaising.claimReward(POOL_ZERO, {from: alice});

        const poolIdToRewardPerBlock = await this.fundRaising.poolIdToRewardPerBlock(POOL_ZERO);
        const totalRewardsForAliceAndBobAfter5Blocks = poolIdToRewardPerBlock.muln(5);
        const totalRewardsAlice = totalRewardsForAliceAndBobAfter5Blocks.muln(2).divn(3); // alice gets 2/3

        const aliceRewardTokenBalAfterClaim = await this.rewardToken1.balanceOf(alice);

        shouldBeNumberInEtherCloseTo(aliceRewardTokenBalAfterClaim, fromWei(totalRewardsAlice));

        // bob claims after 6 blocks
        const totalRewardsForAliceAndBobAfter6Blocks = poolIdToRewardPerBlock.muln(6);
        const totalRewardsBob = totalRewardsForAliceAndBobAfter6Blocks.divn(3); // bob gets 1/3

        await this.fundRaising.claimReward(POOL_ZERO, {from: bob});

        const bobRewardTokenBalAfterClaim = await this.rewardToken1.balanceOf(bob);

        shouldBeNumberInEtherCloseTo(bobRewardTokenBalAfterClaim, fromWei(totalRewardsBob));
      });
    });

  });


});
