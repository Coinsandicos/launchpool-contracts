const {time, BN, expectRevert, constants} = require('@openzeppelin/test-helpers');

const LaunchPoolToken = artifacts.require('LaunchPoolToken');
const LaunchPoolStakingWithGuild = artifacts.require('LaunchPoolStakingWithGuild');

require('chai').should();

contract('LaunchPoolStakingWithGuild', ([adminAlice, bob, carol, daniel, minter, referer, launchPoolAdmin, whitelister]) => {

  const to18DP = (value) => {
    return new BN(value).mul(new BN('10').pow(new BN('18')));
  };

  const toBn = (value) => new BN(value);

  const setupUsers = async (token, from) => {
    await token.transfer(bob, ONE_THOUSAND_TOKENS, {from});
    await token.transfer(carol, ONE_THOUSAND_TOKENS, {from});
    await token.transfer(daniel, ONE_THOUSAND_TOKENS, {from});
  };

  const checkRewards = async (pool, from, lptUserBalance, lptPendingBalance, updatePool = true) => {
    if (updatePool) {
      await this.staking.updatePool(pool, {from});
    }
    assert.equal((await this.launchPoolToken.balanceOf(from)).toString(), to18DP(lptUserBalance).toString());
    assert.equal((await this.staking.pendingLpt(pool, from)).toString(), to18DP(lptPendingBalance).toString());
  };

  const ONE_THOUSAND_TOKENS = to18DP('1000');
  const TEN_THOUSAND_TOKENS = to18DP('10000');

  const POOL_ZERO = new BN('0');

  beforeEach(async () => {
    this.launchPoolToken = await LaunchPoolToken.new(TEN_THOUSAND_TOKENS, launchPoolAdmin, {from: adminAlice});

    this.startBlock = await time.latestBlock();

    this.staking = await LaunchPoolStakingWithGuild.new(
      this.launchPoolToken.address,
      to18DP('1000'), // 1k rewards = 10 rewards per block
      this.startBlock.add(toBn('100')), // start mining block number
      this.startBlock.add(toBn('200')), // end mining block number
      {from: adminAlice}
    );

    const guildBankAddress = await this.staking.rewardGuildBank()

    // transfer tokens to launch pool so they can be allocation accordingly
    await this.launchPoolToken.transfer(guildBankAddress, ONE_THOUSAND_TOKENS, {from: launchPoolAdmin});

    // Confirm reward per block
    assert.equal((await this.staking.lptPerBlock()).toString(), to18DP('10'));

    await setupUsers(this.launchPoolToken, launchPoolAdmin)
  })

  describe('When staking token is the same as reward token (both $LPOOL)', () => {
    const depositAmount = new BN('100')

    beforeEach(async () => {
      // add the first and only pool
      await this.staking.add(depositAmount, this.launchPoolToken.address, ONE_THOUSAND_TOKENS, false, {from: adminAlice});
    })

    it('rewards are correct', async () => {
      // Deposit liquidity into pool
      await this.launchPoolToken.approve(this.staking.address, ONE_THOUSAND_TOKENS, {from: bob});
      await this.staking.deposit(POOL_ZERO, ONE_THOUSAND_TOKENS, {from: bob});
      await time.advanceBlockTo(this.startBlock.add(toBn('89')));

      // Move into block 110 to trigger 10 block reward
      await time.advanceBlockTo(this.startBlock.add(toBn('110')));
      await checkRewards(POOL_ZERO, bob, '0', '100', false); // 10 blocks x 10

      // for master-chef to trigger a pending payment you deposit a zero amount
      // this updates the internal balances and pays any owed reward tokens
      await this.staking.deposit(POOL_ZERO, '0', {from: bob});
      await checkRewards(POOL_ZERO, bob, '110', '0', false); // moved 10 + 1 for execution = 11 blocks past

      // move to block before end time
      await time.advanceBlockTo(this.startBlock.add(toBn('199')));
      await checkRewards(POOL_ZERO, bob, '110', '880', false); // 88 due 11 blocks which are already claimed

      // Claim them on block 200
      await this.staking.deposit(POOL_ZERO, '0', {from: bob});
      assert.equal((await time.latestBlock()).toString(), this.startBlock.add(toBn('200'))); // confirm now on the cusp

      // all claims 100 X 10 = 1000
      // no remaining lpt
      await checkRewards(POOL_ZERO, bob, '1000', '0', false);

      // move after closed
      await time.advanceBlockTo(this.startBlock.add(toBn('201')));
      // still no remaining lpt
      await checkRewards(POOL_ZERO, bob, '1000', '0', false);

      // no change after claiming
      await this.staking.deposit(POOL_ZERO, '0', {from: bob});

      // balance stays same
      await checkRewards(POOL_ZERO, bob, '1000', '0', false);
    })
  })
})
