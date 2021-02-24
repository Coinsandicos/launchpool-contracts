const {time, BN, expectRevert, constants} = require('@openzeppelin/test-helpers');

const LaunchPoolToken = artifacts.require('LaunchPoolToken');
const LaunchPoolStakingWithGuild = artifacts.require('LaunchPoolStakingWithGuild');

require('chai').should();
const { expect } = require('chai')

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
    this.guildBankAddress = guildBankAddress

    // transfer tokens to launch pool so they can be allocation accordingly
    await this.launchPoolToken.transfer(guildBankAddress, ONE_THOUSAND_TOKENS, {from: launchPoolAdmin});

    // Confirm reward per block
    assert.equal((await this.staking.lptPerBlock()).toString(), to18DP('10'));

    expect(await this.launchPoolToken.balanceOf(guildBankAddress)).to.be.bignumber.equal(ONE_THOUSAND_TOKENS)

    await setupUsers(this.launchPoolToken, launchPoolAdmin)
  })

  describe('When staking token is the same as reward token (both $LPOOL)', () => {
    const depositAmount = new BN('100')

    beforeEach(async () => {
      // add the first and only pool
      await this.staking.add(depositAmount, this.launchPoolToken.address, ONE_THOUSAND_TOKENS, false, {from: adminAlice});
    })

    it('rewards are correct', async () => {
      expect(await this.launchPoolToken.balanceOf(this.guildBankAddress)).to.be.bignumber.equal(ONE_THOUSAND_TOKENS)

      // Deposit liquidity into pool
      await this.launchPoolToken.approve(this.staking.address, ONE_THOUSAND_TOKENS, {from: bob});
      await this.staking.deposit(POOL_ZERO, ONE_THOUSAND_TOKENS, {from: bob});

      expect(await this.launchPoolToken.balanceOf(this.staking.address)).to.be.bignumber.equal(ONE_THOUSAND_TOKENS)
      expect(await this.launchPoolToken.balanceOf(this.guildBankAddress)).to.be.bignumber.equal(ONE_THOUSAND_TOKENS)

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

  context('withdraw()', async () => {

    beforeEach(async () => {
      this.startBlock = await time.latestBlock();
    });

    it('fails to withdraw if you specify more than you own', async () => {

      this.staking = await LaunchPoolStakingWithGuild.new(
        this.launchPoolToken.address,
        to18DP('1000'), // 1k rewards = 10 rewards per block
        this.startBlock.add(toBn('100')), // start mining block number
        this.startBlock.add(toBn('200')), // end mining block number
        {from: adminAlice}
      );

      // add the first and only pool
      await this.staking.add('100', this.launchPoolToken.address, ONE_THOUSAND_TOKENS, true, {from: adminAlice});

      // stake some coins from bob
      await this.launchPoolToken.approve(this.staking.address, '1000', {from: bob});
      await this.staking.deposit(POOL_ZERO, '100', {from: bob});

      await time.advanceBlockTo(this.startBlock.add(toBn('110')));

      await expectRevert(
        this.staking.withdraw(POOL_ZERO, '101', {from: bob}), // more than bob deposited
        'withdraw: _amount not good'
      );
    });

    it('successfully withdraws if you specify to an amount you own to withdraw', async () => {

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

      // add the first and only pool
      await this.staking.add('100', this.launchPoolToken.address, ONE_THOUSAND_TOKENS, true, {from: adminAlice});

      // stake some coins from bob
      await this.launchPoolToken.approve(this.staking.address, ONE_THOUSAND_TOKENS, {from: bob});
      await this.staking.deposit(POOL_ZERO, ONE_THOUSAND_TOKENS, {from: bob});

      await time.advanceBlockTo(this.startBlock.add(toBn('110')));

      // sends pending but leaves stake
      await this.staking.withdraw(POOL_ZERO, '0', {from: bob});

      assert.equal((await this.launchPoolToken.balanceOf(bob)).toString(), to18DP('110'));

      // withdraw all
      await this.staking.withdraw(POOL_ZERO, ONE_THOUSAND_TOKENS, {from: bob});

      assert.equal((await this.launchPoolToken.balanceOf(bob)).toString(), to18DP('120').add(ONE_THOUSAND_TOKENS)); // one more block passed
    });

    it('successfully withdraws pending rewards and stake if you specify to an amount you own to withdraw', async () => {

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

      // add the first and only pool
      await this.staking.add('100', this.launchPoolToken.address, ONE_THOUSAND_TOKENS, true, {from: adminAlice});

      // stake some coins from bob
      await this.launchPoolToken.approve(this.staking.address, ONE_THOUSAND_TOKENS, {from: bob});
      await this.staking.deposit(POOL_ZERO, ONE_THOUSAND_TOKENS, {from: bob});

      await time.advanceBlockTo(this.startBlock.add(toBn('110')));

      assert.equal((await this.launchPoolToken.balanceOf(bob)).toString(), '0');

      // withdraw all
      await this.staking.withdraw(POOL_ZERO, ONE_THOUSAND_TOKENS, {from: bob});

      assert.equal((await this.launchPoolToken.balanceOf(bob)).toString(), to18DP('110').add(ONE_THOUSAND_TOKENS));
    });

  });

  describe('owner functions', () => {

    const startBlock = '0';
    const endBlock = '100';

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
    });

    it('can not "add" if not owner', async () => {
      await expectRevert(
        this.staking.add('100', this.launchPoolToken.address, ONE_THOUSAND_TOKENS, true, {from: bob}),
        'Ownable: caller is not the owner'
      );
    });

    it('can not "add" if token is zero address', async () => {
      await expectRevert(
        this.staking.add('100', constants.ZERO_ADDRESS, ONE_THOUSAND_TOKENS, true, {from: adminAlice}),
        'add: _erc20Token must not be zero address'
      );
    });

    it('can not "add" if token cap is zero', async () => {
      await expectRevert(
        this.staking.add('100', this.staking.address, toBn('0'), true, {from: adminAlice}),
        'add: _maxStakingAmountPerUser must be greater than zero'
      );
    });

    it('can not "set" if not owner', async () => {
      await expectRevert(
        this.staking.set(POOL_ZERO, '100', ONE_THOUSAND_TOKENS, true, {from: bob}),
        'Ownable: caller is not the owner'
      );
    });

    it('can not "set" if token cap is zero', async () => {
      await this.staking.add('100', this.staking.address, toBn('5'), true, {from: adminAlice})
      await expectRevert(
        this.staking.set(POOL_ZERO, '100', toBn('0'), true, {from: adminAlice}),
        'set: _maxStakingAmountPerUser must be greater than zero'
      );
    });

    it('can "set" with invalid pid', async () => {
      await expectRevert(
        this.staking.set('1', '500', ONE_THOUSAND_TOKENS, true, {from: adminAlice}),
        'set: invalid _pid'
      );
    });

    it('can "set" if owner (with update)', async () => {
      await this.staking.add('100', this.staking.address, toBn('5'), true, {from: adminAlice});

      assert.equal((await this.staking.poolInfo(POOL_ZERO))[1].toString(), '100'); // allocPoint

      await this.staking.set(POOL_ZERO, '500', ONE_THOUSAND_TOKENS, true, {from: adminAlice});
      assert.equal((await this.staking.poolInfo(POOL_ZERO))[1].toString(), '500'); // allocPoint
    });

    it('can "set" if owner (without update)', async () => {
      await this.staking.add('100', this.staking.address, toBn('5'), true, {from: adminAlice});

      assert.equal((await this.staking.poolInfo(POOL_ZERO))[1].toString(), '100'); // allocPoint

      await this.staking.set(POOL_ZERO, '500', ONE_THOUSAND_TOKENS, false, {from: adminAlice});
      assert.equal((await this.staking.poolInfo(POOL_ZERO))[1].toString(), '500'); // allocPoint
    });

    it('can not "add" or "set" if after completion', async () => {
      await time.advanceBlockTo(this.startBlock.add(toBn('201')));
      await expectRevert(
        this.staking.add('100', this.launchPoolToken.address, ONE_THOUSAND_TOKENS, true, {from: adminAlice}),
        'add: must be before end'
      );

      await expectRevert(
        this.staking.set(POOL_ZERO, '100', ONE_THOUSAND_TOKENS, true, {from: adminAlice}),
        'set: must be before end'
      );
    });
  });

  context('emergencyWithdraw()', async () => {

    beforeEach(async () => {
      this.launchPoolToken = await LaunchPoolToken.new(TEN_THOUSAND_TOKENS, launchPoolAdmin, {from: adminAlice});

      this.startBlock = await time.latestBlock();
      console.log('Starting block', this.startBlock.toString());

      await setupUsers(this.launchPoolToken, launchPoolAdmin)
    });

    it('should allow emergency withdraw', async () => {

      // 100 per block farming rate starting at block 100 with all issuance ending on block 200
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

      // add the first and only pool
      await this.staking.add('100', this.launchPoolToken.address, ONE_THOUSAND_TOKENS, true, {from: adminAlice});

      // Confirm reward per block
      assert.equal((await this.staking.lptPerBlock()).toString(), to18DP('10'));

      // Deposit liquidity into pool
      await this.launchPoolToken.approve(this.staking.address, ONE_THOUSAND_TOKENS, {from: bob});
      await this.staking.deposit(POOL_ZERO, ONE_THOUSAND_TOKENS, {from: bob});
      await time.advanceBlockTo(this.startBlock.add(toBn('89')));

      // trigger pool update before block reward started, ensure all zeros still
      await this.staking.updatePool(POOL_ZERO, {from: bob}); // block 90
      await checkRewards(POOL_ZERO, bob, '0', '0');

      // Move into block 110 to trigger 10 block reward
      await time.advanceBlockTo(this.startBlock.add(toBn('110')));
      await this.staking.deposit(POOL_ZERO, '0', {from: bob}); // claim them rewards!
      await checkRewards(POOL_ZERO, bob, '110', '10', true);

      // move blocks on further
      await time.advanceBlockTo(this.startBlock.add(toBn('150')));
      await checkRewards(POOL_ZERO, bob, '110', '390', false);

      // trigger the reactor meltdown
      await this.staking.emergencyWithdraw(POOL_ZERO, {from: bob});

      // check pending goes to zero after emergency shut down
      await checkRewards(POOL_ZERO, bob, '1110', '0', true);
    });

    it('should revert emergency withdraw with invalid pid', async () => {

      // 100 per block farming rate starting at block 100 with all issuance ending on block 200
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

      // add the first and only pool
      await this.staking.add('100', this.launchPoolToken.address, ONE_THOUSAND_TOKENS, true, {from: adminAlice});

      // Deposit liquidity into pool
      await this.launchPoolToken.approve(this.staking.address, '1000', {from: bob});
      await this.staking.deposit(POOL_ZERO, '100', {from: bob});
      await time.advanceBlockTo(this.startBlock.add(toBn('89')));

      //  ooops
      await expectRevert(
        this.staking.emergencyWithdraw('1', {from: bob}),
        'updatePool: invalid _pid'
      );
    });
  });
})
