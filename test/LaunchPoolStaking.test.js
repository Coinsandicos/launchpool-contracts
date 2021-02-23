const {time, BN, expectRevert, constants} = require('@openzeppelin/test-helpers');

const MockERC20 = artifacts.require('MockERC20');
const LaunchPoolToken = artifacts.require('LaunchPoolToken');
const LaunchPoolStaking = artifacts.require('LaunchPoolStaking');

require('chai').should();

contract('LaunchPoolStaking', ([adminAlice, bob, carol, daniel, minter, referer, launchPoolAdmin, whitelister]) => {

  const to18DP = (value) => {
    return new BN(value).mul(new BN('10').pow(new BN('18')));
  };

  const toBn = (value) => new BN(value);

  const ONE_THOUSAND_TOKENS = to18DP('1000');
  const TEN_THOUSAND_TOKENS = to18DP('10000');

  const makeCoinAndSetupUsers = async (name, symbol, from) => {
    const coin = await MockERC20.new(name, symbol, ONE_THOUSAND_TOKENS.mul(new BN('4')), {from: from});
    await coin.transfer(bob, ONE_THOUSAND_TOKENS, {from});
    await coin.transfer(carol, ONE_THOUSAND_TOKENS, {from});
    await coin.transfer(daniel, ONE_THOUSAND_TOKENS, {from});
    return coin;
  };

  const checkRewards = async (pool, from, lptUserBalance, lptPendingBalance, updatePool = true) => {
    if (updatePool) {
      await this.staking.updatePool(pool, {from});
    }
    assert.equal((await this.launchPoolToken.balanceOf(from)).toString(), to18DP(lptUserBalance).toString());
    assert.equal((await this.staking.pendingLpt(pool, from)).toString(), to18DP(lptPendingBalance).toString());
  };

  const POOL_ZERO = new BN('0');
  const POOL_ONE = new BN('1');

  const rewardLimit = ONE_THOUSAND_TOKENS;

  it('should set correct state variables', async () => {

    const startBlock = '0';
    const endBlock = '100';

    this.launchPoolToken = await LaunchPoolToken.new(ONE_THOUSAND_TOKENS, launchPoolAdmin, {from: adminAlice});
    this.xtp = await MockERC20.new('TAP Token', 'XTP', '10000000000', {from: minter});

    this.staking = await LaunchPoolStaking.new(
      this.launchPoolToken.address,
      rewardLimit,
      startBlock,
      endBlock,
      {from: adminAlice}
    );

    (await this.staking.maxLPTAvailableForFarming()).should.be.bignumber.equal(rewardLimit);
    (await this.staking.startBlock()).should.be.bignumber.equal(startBlock);
    (await this.staking.endBlock()).should.be.bignumber.equal(endBlock);

    const blockReward = new BN(rewardLimit).div(new BN(endBlock).sub(new BN(startBlock)));
    (await this.staking.lptPerBlock()).should.be.bignumber.equal(blockReward);
  });

  context('With one token added to the staking pools', () => {
    it('revert if rewards token address is zero', async () => {
      await expectRevert(
        LaunchPoolStaking.new(
          constants.ZERO_ADDRESS,
          rewardLimit,
          0,
          1,
          {from: adminAlice}
        ),
        'constructor: _lpt must not be zero address'
      );
    });

    it('revert if reward limit is zero', async () => {

      this.launchPoolToken = await LaunchPoolToken.new(ONE_THOUSAND_TOKENS, launchPoolAdmin, {from: adminAlice});
      await expectRevert(
        LaunchPoolStaking.new(
          this.launchPoolToken.address,
          0,
          1,
          2,
          {from: adminAlice}
        ),
        'constructor: _maxLPTAvailableForFarming must be greater than zero'
      );
    });
  });

  context('With one token added to the staking pools', () => {

    beforeEach(async () => {
      this.launchPoolToken = await LaunchPoolToken.new(TEN_THOUSAND_TOKENS, launchPoolAdmin, {from: adminAlice});

      // setup initial LP coin
      this.xtp = await makeCoinAndSetupUsers('LPToken', 'XTP', minter);

      this.startBlock = await time.latestBlock();

      console.log('Starting block', this.startBlock.toString());
    });

    it('should issue reward tokens during the staking period', async () => {

      // 100 per block farming rate starting at block 100 with all issuance ending on block 200
      this.staking = await LaunchPoolStaking.new(
        this.launchPoolToken.address,
        to18DP('1000'), // 1k rewards = 10 rewards per block
        this.startBlock.add(toBn('100')), // start mining block number
        this.startBlock.add(toBn('200')), // end mining block number
        {from: adminAlice}
      );

      // transfer tokens to launch pool so they can be allocation accordingly
      await this.launchPoolToken.transfer(this.staking.address, ONE_THOUSAND_TOKENS, {from: launchPoolAdmin});

      // add the first and only pool
      await this.staking.add('100', this.xtp.address, ONE_THOUSAND_TOKENS, true, {from: adminAlice});

      // Confirm reward per block
      assert.equal((await this.staking.lptPerBlock()).toString(), to18DP('10'));

      // Deposit liquidity into pool
      await this.xtp.approve(this.staking.address, '1000', {from: bob});
      await this.staking.deposit(POOL_ZERO, '100', {from: bob});
      await time.advanceBlockTo(this.startBlock.add(toBn('89')));

      // trigger pool update before block reward started, ensure all zeros still
      await this.staking.updatePool(POOL_ZERO, {from: bob}); // block 90
      await checkRewards(POOL_ZERO, bob, '0', '0');

      // Move into block 110 to trigger 10 block reward
      await time.advanceBlockTo(this.startBlock.add(toBn('110')));
      await checkRewards(POOL_ZERO, bob, '0', '100', false); // 10 blocks x 10

      // for master-chef to trigger a pending payment you deposit a zero amount
      // this updates the internal balances and pays any owed reward tokens
      await this.staking.deposit(POOL_ZERO, '0', {from: bob});
      await checkRewards(POOL_ZERO, bob, '110', '0', false); // moved 10 + 1 for execution = 11 blocks past = 11 x 10 = 110

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

    });

    it('should issue reward tokens correctly with two people in the pool of the same share holdings', async () => {

      // 100 per block farming rate starting at block 100 with all issuance ending on block 200
      this.staking = await LaunchPoolStaking.new(
        this.launchPoolToken.address,
        to18DP('1000'), // 1k rewards = 10 rewards per block, split by two people = 5 per person per block
        this.startBlock.add(toBn('100')), // start mining block number
        this.startBlock.add(toBn('200')), // end mining block number
        {from: adminAlice}
      );

      // transfer tokens to launch pool so they can be allocation accordingly
      await this.launchPoolToken.transfer(this.staking.address, ONE_THOUSAND_TOKENS, {from: launchPoolAdmin});

      // add the first and only pool
      await this.staking.add('100', this.xtp.address, ONE_THOUSAND_TOKENS, true, {from: adminAlice});

      // Confirm reward per block
      assert.equal((await this.staking.lptPerBlock()).toString(), to18DP('10'));

      // Deposit liquidity into pool from Bob
      await this.xtp.approve(this.staking.address, '1000', {from: bob});
      await this.staking.deposit(POOL_ZERO, '100', {from: bob});

      // Deposit liquidity into pool from Carol
      await this.xtp.approve(this.staking.address, '1000', {from: carol});
      await this.staking.deposit(POOL_ZERO, '100', {from: carol});

      await time.advanceBlockTo(this.startBlock.add(toBn('89')));

      // trigger pool update before block reward started, ensure all zeros still
      await checkRewards(POOL_ZERO, bob, '0', '0');
      await checkRewards(POOL_ZERO, carol, '0', '0');

      // Move into block 100 to trigger 1 block reward
      await time.advanceBlockTo(this.startBlock.add(toBn('101')));

      // 1 block past, 50/50 split = 5 per person per block
      assert.equal((await this.staking.pendingLpt(POOL_ZERO, bob)).toString(), to18DP('5'));
      assert.equal((await this.staking.pendingLpt(POOL_ZERO, carol)).toString(), to18DP('5'));

      // move to 50% through the reward schedule
      await time.advanceBlockTo(this.startBlock.add(toBn('150')));
      await checkRewards(POOL_ZERO, bob, '0', '255');
      await checkRewards(POOL_ZERO, carol, '0', '260'); // 255 + 1 block = 260

      // bob claims
      await this.staking.deposit(POOL_ZERO, '0', {from: bob});
      await checkRewards(POOL_ZERO, bob, '265', '0', false);

      // carol claims
      await this.staking.deposit(POOL_ZERO, '0', {from: carol});
      await checkRewards(POOL_ZERO, carol, '270', '0', false); // + 1 block
      assert.equal((await this.staking.pendingLpt(POOL_ZERO, bob)).toString(), to18DP('5')); // bob now due another 5

      // Move to close pool
      await time.advanceBlockTo(this.startBlock.add(toBn('201')));

      await this.staking.deposit(POOL_ZERO, '0', {from: bob});
      await checkRewards(POOL_ZERO, bob, '500', '0', false);

      await this.staking.deposit(POOL_ZERO, '0', {from: carol});
      await checkRewards(POOL_ZERO, carol, '500', '0', false);
    });

    it('should issue reward tokens correctly with two people in one pool but with different holdings', async () => {

      /////////////////////////////
      // Bob holds 30% of pool   //
      // carol holds 70% of pool //
      /////////////////////////////

      // 100 per block farming rate starting at block 100 with all issuance ending on block 200
      this.staking = await LaunchPoolStaking.new(
        this.launchPoolToken.address,
        to18DP('1000'), // 1k rewards = 10 rewards per block
        this.startBlock.add(toBn('100')), // start mining block number
        this.startBlock.add(toBn('200')), // end mining block number
        {from: adminAlice}
      );

      // transfer tokens to launch pool so they can be allocation accordingly
      await this.launchPoolToken.transfer(this.staking.address, ONE_THOUSAND_TOKENS, {from: launchPoolAdmin});

      // add the first and only pool
      await this.staking.add('100', this.xtp.address, ONE_THOUSAND_TOKENS, true, {from: adminAlice});

      // Confirm reward per block
      assert.equal((await this.staking.lptPerBlock()).toString(), to18DP('10'));

      // Deposit liquidity into pool from Bob
      await this.xtp.approve(this.staking.address, '1000', {from: bob});
      await this.staking.deposit(POOL_ZERO, '30', {from: bob});

      // Deposit liquidity into pool from Carol
      await this.xtp.approve(this.staking.address, '1000', {from: carol});
      await this.staking.deposit(POOL_ZERO, '70', {from: carol});

      await time.advanceBlockTo(this.startBlock.add(toBn('89')));

      // trigger pool update before block reward started, ensure all zeros still
      await checkRewards(POOL_ZERO, bob, '0', '0');
      await checkRewards(POOL_ZERO, carol, '0', '0');

      // Move into block 100 to trigger 1 block reward
      await time.advanceBlockTo(this.startBlock.add(toBn('101')));

      // 1 block past, 30/70 split
      assert.equal((await this.staking.pendingLpt(POOL_ZERO, bob)).toString(), to18DP('3'));
      assert.equal((await this.staking.pendingLpt(POOL_ZERO, carol)).toString(), to18DP('7'));

      // move to 50% through the reward schedule
      await time.advanceBlockTo(this.startBlock.add(toBn('150')));
      await checkRewards(POOL_ZERO, bob, '0', '153'); // 50 * 3 + 1 block = 153
      await checkRewards(POOL_ZERO, carol, '0', '364'); // 50 * 7 + 2 block = 364

      // bob claims
      await this.staking.deposit(POOL_ZERO, '0', {from: bob});
      await checkRewards(POOL_ZERO, bob, '159', '0', false);

      // carol claims
      await this.staking.deposit(POOL_ZERO, '0', {from: carol});
      await checkRewards(POOL_ZERO, carol, '378', '0', false); // + 1 block
      assert.equal((await this.staking.pendingLpt(POOL_ZERO, bob)).toString(), to18DP('3')); // bob now due another 3

      // Move to close pool
      await time.advanceBlockTo(this.startBlock.add(toBn('201')));

      await this.staking.deposit(POOL_ZERO, '0', {from: bob});
      await checkRewards(POOL_ZERO, bob, '300', '0', false);

      await this.staking.deposit(POOL_ZERO, '0', {from: carol});
      await checkRewards(POOL_ZERO, carol, '700', '0', false);
    });

    it('should issue reward tokens with two differently allocated pools, 1 person in each pool, different amounts deposited', async () => {

      ////////////////////////////////
      // 2 pools of equal weighting //
      // pool 1 has 100 allocation  //
      // pool 1 has 50 allocation   //
      ////////////////////////////////

      // 100 per block farming rate starting at block 100 with all issuance ending on block 200
      this.staking = await LaunchPoolStaking.new(
        this.launchPoolToken.address,
        to18DP('1000'), // 1k rewards = 10 rewards per block
        this.startBlock.add(toBn('100')), // start mining block number
        this.startBlock.add(toBn('200')), // end mining block number
        {from: adminAlice}
      );

      // transfer tokens to launch pool so they can be allocation accordingly
      await this.launchPoolToken.transfer(this.staking.address, ONE_THOUSAND_TOKENS, {from: launchPoolAdmin});

      // add the first pool
      await this.staking.add('100', this.xtp.address, ONE_THOUSAND_TOKENS, true, {from: adminAlice});

      // Make another coin for the pool
      this.xrp = await makeCoinAndSetupUsers('XRPPooCoin', 'XRP', minter);
      await this.staking.add('50', this.xrp.address, ONE_THOUSAND_TOKENS, true, {from: adminAlice});

      // check pool length now
      assert.equal((await this.staking.numberOfPools()).toString(), '2');

      // Deposit liquidity into pool 0
      await this.xtp.approve(this.staking.address, '1000', {from: bob});
      await this.staking.deposit(POOL_ZERO, '100', {from: bob});

      // Deposit 50 liquidity into pool 1
      await this.xrp.approve(this.staking.address, '1000', {from: bob});
      await this.staking.deposit(POOL_ONE, '50', {from: bob});

      await time.advanceBlockTo(this.startBlock.add(toBn('89')));

      // trigger pool update before block reward started, ensure all zeros still
      await this.staking.updatePool(POOL_ZERO, {from: bob});
      await checkRewards(POOL_ZERO, bob, '0', '0');
      await checkRewards(POOL_ONE, bob, '0', '0');

      // Move into block 110 to trigger some rewards from each, split accordingly
      await time.advanceBlockTo(this.startBlock.add(toBn('110')));
      assert.equal((await this.staking.pendingLpt(POOL_ZERO, bob)).toString(), '66666666666666666666');
      assert.equal((await this.staking.pendingLpt(POOL_ONE, bob)).toString(), '33333333333333333333');

      // trigger draw down on both
      await this.staking.deposit(POOL_ZERO, '0', {from: bob});
      await this.staking.deposit(POOL_ONE, '0', {from: bob});

      // Show me the money ...
      assert.equal((await this.launchPoolToken.balanceOf(bob)).toString(), '113333333333333333333');

      // check pending
      assert.equal((await this.staking.pendingLpt(POOL_ZERO, bob)).toString(), '6666666666666666666'); // one block since cleared
      assert.equal((await this.staking.pendingLpt(POOL_ONE, bob)).toString(), '0'); // zero left

      // move to block just before end time for both pool
      await time.advanceBlockTo(this.startBlock.add(toBn('199')));
      assert.equal((await this.staking.pendingLpt(POOL_ZERO, bob)).toString(), '586666666666666666666'); // nearly the full amount
      assert.equal((await this.staking.pendingLpt(POOL_ONE, bob)).toString(), '290000000000000000000');

      // Claim them on block 200
      await this.staking.deposit(POOL_ZERO, '0', {from: bob});
      await this.staking.deposit(POOL_ONE, '0', {from: bob});
      assert.equal((await time.latestBlock()).toString(), this.startBlock.add(toBn('201'))); // confirm finished

      // all tokens received, pools now cleared
      assert.equal((await this.launchPoolToken.balanceOf(bob)).toString(), '999999999999999999999');
      assert.equal((await this.staking.pendingLpt(POOL_ZERO, bob)).toString(), to18DP('0')); // no remaining lpt
      assert.equal((await this.staking.pendingLpt(POOL_ONE, bob)).toString(), to18DP('0')); // no remaining lpt

      // move after closed
      await time.advanceBlockTo(this.startBlock.add(toBn('201')));
      assert.equal((await this.staking.pendingLpt(POOL_ZERO, bob)).toString(), '0'); // still no remaining lpt
      assert.equal((await this.staking.pendingLpt(POOL_ONE, bob)).toString(), '0'); // still no remaining lpt

      // no change after claiming
      await this.staking.deposit(POOL_ZERO, '0', {from: bob});
      await this.staking.deposit(POOL_ONE, '0', {from: bob});
      assert.equal((await this.launchPoolToken.balanceOf(bob)).toString(), '999999999999999999999'); // balance stays same
    });

    it.only('should issue reward tokens with two differently allocated pools, 1 person in each pool, and set one pool to zero', async () => {

      ////////////////////////////////
      // 2 pools of equal weighting //
      // pool 1 has 100 allocation  //
      // pool 1 has 50 allocation   //
      ////////////////////////////////

      // 100 per block farming rate starting at block 100 with all issuance ending on block 200
      this.staking = await LaunchPoolStaking.new(
        this.launchPoolToken.address,
        to18DP('1000'), // 1k rewards = 10 rewards per block
        this.startBlock.add(toBn('100')), // start mining block number
        this.startBlock.add(toBn('200')), // end mining block number
        {from: adminAlice}
      );

      // transfer tokens to launch pool so they can be allocation accordingly
      await this.launchPoolToken.transfer(this.staking.address, ONE_THOUSAND_TOKENS, {from: launchPoolAdmin});

      // add the first pool
      await this.staking.add('100', this.xtp.address, ONE_THOUSAND_TOKENS, true, {from: adminAlice});

      // Make another coin for the pool
      this.xrp = await makeCoinAndSetupUsers('XRPPooCoin', 'XRP', minter);
      await this.staking.add('50', this.xrp.address, ONE_THOUSAND_TOKENS, true, {from: adminAlice});

      // check pool length now
      assert.equal((await this.staking.numberOfPools()).toString(), '2');

      // Deposit liquidity into pool 0
      await this.xtp.approve(this.staking.address, '1000', {from: bob});
      await this.staking.deposit(POOL_ZERO, '100', {from: bob});

      // Deposit 50 liquidity into pool 1
      await this.xrp.approve(this.staking.address, '1000', {from: bob});
      await this.staking.deposit(POOL_ONE, '50', {from: bob});

      // Move into block 110 to trigger some rewards from each, split accordingly
      await time.advanceBlockTo(this.startBlock.add(toBn('110')));

      assert.equal((await this.staking.pendingLpt(POOL_ZERO, bob)).toString(), '66666666666666666666');
      assert.equal((await this.staking.pendingLpt(POOL_ONE, bob)).toString(), '33333333333333333333');

      // await this.staking.updatePool('0');
      // await this.staking.updatePool('1');

      // set zero to zero
      await this.staking.set('0', '0', ONE_THOUSAND_TOKENS, true, {from: adminAlice});
      await this.staking.set('1', '150', ONE_THOUSAND_TOKENS, true, {from: adminAlice});

      // check pending
      assert.equal((await this.staking.pendingLpt(POOL_ZERO, bob)).toString(), '73333333333333333333'); // one block since cleared
      assert.equal((await this.staking.pendingLpt(POOL_ONE, bob)).toString(), '46666666666666666666'); // zero left

      await time.advanceBlockTo(this.startBlock.add(toBn('125')));

      assert.equal((await this.staking.pendingLpt(POOL_ZERO, bob)).toString(), '73333333333333333333'); // one block since cleared
      assert.equal((await this.staking.pendingLpt(POOL_ONE, bob)).toString(), '176666666666666666666'); // zero left

      // trigger draw down on both
      await this.staking.deposit(POOL_ZERO, '0', {from: bob});
      await this.staking.deposit(POOL_ONE, '0', {from: bob});

      await time.advanceBlockTo(this.startBlock.add(toBn('150')));

      assert.equal((await this.staking.pendingLpt(POOL_ZERO, bob)).toString(), '0');
      assert.equal((await this.staking.pendingLpt(POOL_ONE, bob)).toString(), '230000000000000000000');

      await this.staking.withdraw(POOL_ZERO, '100', {from: bob});

      // Deposit liquidity into pool 0
      await this.xrp.approve(this.staking.address, '1000', {from: bob});
      await this.staking.deposit(POOL_ONE, '50', {from: bob});

      await time.advanceBlockTo(this.startBlock.add(toBn('210')));

      // Deposit liquidity into pool 0
      await this.xtp.approve(this.staking.address, '1000', {from: bob});
      await this.staking.deposit(POOL_ZERO, '100', {from: bob});

      assert.equal((await this.staking.pendingLpt(POOL_ZERO, bob)).toString(), '0');
      assert.equal((await this.staking.pendingLpt(POOL_ONE, bob)).toString(), '470000000000000000000');

      await this.staking.withdraw(POOL_ONE, '100', {from: bob});
    });

    it('should reverts if exceeded token cap for deposits', async () => {

      // 100 per block farming rate starting at block 100 with all issuance ending on block 200
      this.staking = await LaunchPoolStaking.new(
        this.launchPoolToken.address,
        to18DP('1000'), // 1k rewards = 10 rewards per block
        this.startBlock.add(toBn('100')), // start mining block number
        this.startBlock.add(toBn('200')), // end mining block number
        {from: adminAlice}
      );

      // transfer tokens to launch pool so they can be allocation accordingly
      await this.launchPoolToken.transfer(this.staking.address, ONE_THOUSAND_TOKENS, {from: launchPoolAdmin});

      // add the first and only pool with a 500 token cap per account!
      await this.staking.add('100', this.xtp.address, to18DP('500'), true, {from: adminAlice});

      // Deposit liquidity into pool
      await this.xtp.approve(this.staking.address, ONE_THOUSAND_TOKENS, {from: bob});
      await this.staking.deposit(POOL_ZERO, to18DP('250'), {from: bob});

      // at token cap
      await this.staking.deposit(POOL_ZERO, to18DP('250'), {from: bob});

      // exceeds
      await expectRevert(
        this.staking.deposit(POOL_ZERO, to18DP('1'), {from: bob}), // more than token cap
        'deposit: can not exceed max staking amount per user'
      );
    });
  });

  context('emergencyWithdraw()', async () => {

    beforeEach(async () => {
      this.launchPoolToken = await LaunchPoolToken.new(TEN_THOUSAND_TOKENS, launchPoolAdmin, {from: adminAlice});

      // setup initial LP coin
      this.xtp = await makeCoinAndSetupUsers('LPToken', 'XTP', minter);

      this.startBlock = await time.latestBlock();
      console.log('Starting block', this.startBlock.toString());
    });

    it('should allow emergency withdraw', async () => {

      // 100 per block farming rate starting at block 100 with all issuance ending on block 200
      this.staking = await LaunchPoolStaking.new(
        this.launchPoolToken.address,
        to18DP('1000'), // 1k rewards = 10 rewards per block
        this.startBlock.add(toBn('100')), // start mining block number
        this.startBlock.add(toBn('200')), // end mining block number
        {from: adminAlice}
      );

      // transfer tokens to launch pool so they can be allocation accordingly
      await this.launchPoolToken.transfer(this.staking.address, ONE_THOUSAND_TOKENS, {from: launchPoolAdmin});

      // add the first and only pool
      await this.staking.add('100', this.xtp.address, ONE_THOUSAND_TOKENS, true, {from: adminAlice});

      // Confirm reward per block
      assert.equal((await this.staking.lptPerBlock()).toString(), to18DP('10'));

      // Deposit liquidity into pool
      await this.xtp.approve(this.staking.address, '1000', {from: bob});
      await this.staking.deposit(POOL_ZERO, '100', {from: bob});
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
      await checkRewards(POOL_ZERO, bob, '110', '0', true);
    });

    it('should revert emergency withdraw with invalid pid', async () => {

      // 100 per block farming rate starting at block 100 with all issuance ending on block 200
      this.staking = await LaunchPoolStaking.new(
        this.launchPoolToken.address,
        to18DP('1000'), // 1k rewards = 10 rewards per block
        this.startBlock.add(toBn('100')), // start mining block number
        this.startBlock.add(toBn('200')), // end mining block number
        {from: adminAlice}
      );

      // transfer tokens to launch pool so they can be allocation accordingly
      await this.launchPoolToken.transfer(this.staking.address, ONE_THOUSAND_TOKENS, {from: launchPoolAdmin});

      // add the first and only pool
      await this.staking.add('100', this.xtp.address, ONE_THOUSAND_TOKENS, true, {from: adminAlice});

      // Deposit liquidity into pool
      await this.xtp.approve(this.staking.address, '1000', {from: bob});
      await this.staking.deposit(POOL_ZERO, '100', {from: bob});
      await time.advanceBlockTo(this.startBlock.add(toBn('89')));

      //  ooops
      await expectRevert(
        this.staking.emergencyWithdraw(POOL_ONE, {from: bob}),
        'updatePool: invalid _pid'
      );
    });
  });

  context('withdraw()', async () => {

    beforeEach(async () => {
      this.launchPoolToken = await LaunchPoolToken.new(TEN_THOUSAND_TOKENS, launchPoolAdmin, {from: adminAlice});

      // setup initial LP coin
      this.xtp = await makeCoinAndSetupUsers('LPToken', 'XTP', minter);

      this.startBlock = await time.latestBlock();
      console.log('Starting block', this.startBlock.toString());
    });

    it('fails to withdraw if you specify more than you own', async () => {

      this.staking = await LaunchPoolStaking.new(
        this.launchPoolToken.address,
        to18DP('1000'), // 1k rewards = 10 rewards per block
        this.startBlock.add(toBn('100')), // start mining block number
        this.startBlock.add(toBn('200')), // end mining block number
        {from: adminAlice}
      );

      // transfer tokens to launch pool so they can be allocation accordingly
      await this.launchPoolToken.transfer(this.staking.address, ONE_THOUSAND_TOKENS, {from: launchPoolAdmin});

      // add the first and only pool
      await this.staking.add('100', this.xtp.address, ONE_THOUSAND_TOKENS, true, {from: adminAlice});

      // stake some coins from bob
      await this.xtp.approve(this.staking.address, '1000', {from: bob});
      await this.staking.deposit(POOL_ZERO, '100', {from: bob});

      await time.advanceBlockTo(this.startBlock.add(toBn('110')));

      await expectRevert(
        this.staking.withdraw(POOL_ZERO, '101', {from: bob}), // more than bob deposited
        'withdraw: _amount not good'
      );
    });

    it('successfully withdraws if you specify to an amount you own to withdraw', async () => {

      this.staking = await LaunchPoolStaking.new(
        this.launchPoolToken.address,
        to18DP('1000'), // 1k rewards = 10 rewards per block
        this.startBlock.add(toBn('100')), // start mining block number
        this.startBlock.add(toBn('200')), // end mining block number
        {from: adminAlice}
      );

      // transfer tokens to launch pool so they can be allocation accordingly
      await this.launchPoolToken.transfer(this.staking.address, ONE_THOUSAND_TOKENS, {from: launchPoolAdmin});

      // add the first and only pool
      await this.staking.add('100', this.xtp.address, ONE_THOUSAND_TOKENS, true, {from: adminAlice});

      // stake some coins from bob
      await this.xtp.approve(this.staking.address, ONE_THOUSAND_TOKENS, {from: bob});
      await this.staking.deposit(POOL_ZERO, ONE_THOUSAND_TOKENS, {from: bob});

      await time.advanceBlockTo(this.startBlock.add(toBn('110')));

      // sends pending but leaves stake
      await this.staking.withdraw(POOL_ZERO, '0', {from: bob});

      assert.equal((await this.xtp.balanceOf(bob)).toString(), '0');
      assert.equal((await this.launchPoolToken.balanceOf(bob)).toString(), to18DP('110'));

      // withdraw all
      await this.staking.withdraw(POOL_ZERO, ONE_THOUSAND_TOKENS, {from: bob});

      assert.equal((await this.xtp.balanceOf(bob)).toString(), ONE_THOUSAND_TOKENS);
      assert.equal((await this.launchPoolToken.balanceOf(bob)).toString(), to18DP('120')); // one more block passed
    });

    it('successfully withdraws pending rewards and stake if you specify to an amount you own to withdraw', async () => {

      this.staking = await LaunchPoolStaking.new(
        this.launchPoolToken.address,
        to18DP('1000'), // 1k rewards = 10 rewards per block
        this.startBlock.add(toBn('100')), // start mining block number
        this.startBlock.add(toBn('200')), // end mining block number
        {from: adminAlice}
      );

      // transfer tokens to launch pool so they can be allocation accordingly
      await this.launchPoolToken.transfer(this.staking.address, ONE_THOUSAND_TOKENS, {from: launchPoolAdmin});

      // add the first and only pool
      await this.staking.add('100', this.xtp.address, ONE_THOUSAND_TOKENS, true, {from: adminAlice});

      // stake some coins from bob
      await this.xtp.approve(this.staking.address, ONE_THOUSAND_TOKENS, {from: bob});
      await this.staking.deposit(POOL_ZERO, ONE_THOUSAND_TOKENS, {from: bob});

      await time.advanceBlockTo(this.startBlock.add(toBn('110')));

      assert.equal((await this.xtp.balanceOf(bob)).toString(), '0');
      assert.equal((await this.launchPoolToken.balanceOf(bob)).toString(), '0');

      // withdraw all
      await this.staking.withdraw(POOL_ZERO, ONE_THOUSAND_TOKENS, {from: bob});

      assert.equal((await this.xtp.balanceOf(bob)).toString(), ONE_THOUSAND_TOKENS);
      assert.equal((await this.launchPoolToken.balanceOf(bob)).toString(), to18DP('110'));
    });

  });

  describe('requires', () => {
    it('reverts if call pendingLpt with incorrect PID', async () => {

      this.staking = await LaunchPoolStaking.new(
        this.launchPoolToken.address,
        to18DP('1000'), // 1k rewards = 10 rewards per block
        this.startBlock.add(toBn('100')), // start mining block number
        this.startBlock.add(toBn('200')), // end mining block number
        {from: adminAlice}
      );

      // transfer tokens to launch pool so they can be allocation accordingly
      await this.launchPoolToken.transfer(this.staking.address, ONE_THOUSAND_TOKENS, {from: launchPoolAdmin});

      // add the first and only pool
      await this.staking.add('100', this.xtp.address, ONE_THOUSAND_TOKENS, true, {from: adminAlice});

      assert.equal((await this.staking.pendingLpt(POOL_ZERO, bob, {from: bob})).toString(), '0');
      assert.equal((await this.staking.pendingLpt(POOL_ZERO, carol, {from: bob})).toString(), '0');

      await expectRevert(
        this.staking.pendingLpt(POOL_ONE, bob, {from: bob}),
        'pendingLpt: invalid _pid'
      );
    });

    it('reverts if call update pool with incorrect PID', async () => {

      this.staking = await LaunchPoolStaking.new(
        this.launchPoolToken.address,
        to18DP('1000'), // 1k rewards = 10 rewards per block
        this.startBlock.add(toBn('100')), // start mining block number
        this.startBlock.add(toBn('200')), // end mining block number
        {from: adminAlice}
      );

      // transfer tokens to launch pool so they can be allocation accordingly
      await this.launchPoolToken.transfer(this.staking.address, ONE_THOUSAND_TOKENS, {from: launchPoolAdmin});

      // add the first and only pool
      await this.staking.add('100', this.xtp.address, ONE_THOUSAND_TOKENS, true, {from: adminAlice});

      await expectRevert(
        this.staking.updatePool(POOL_ONE, {from: bob}),
        'updatePool: invalid _pid'
      );
    });
  });

  describe('owner functions', () => {

    const startBlock = '0';
    const endBlock = '100';

    beforeEach(async () => {
      this.launchPoolToken = await LaunchPoolToken.new(ONE_THOUSAND_TOKENS, launchPoolAdmin, {from: adminAlice});

      this.xtp = await makeCoinAndSetupUsers('LPToken', 'XTP', minter);

      this.staking = await LaunchPoolStaking.new(
        this.launchPoolToken.address,
        rewardLimit,
        this.startBlock.add(toBn('100')), // start mining block number
        this.startBlock.add(toBn('200')), // end mining block number
        {from: adminAlice}
      );

      // add the first and only pool
      await this.staking.add('100', this.xtp.address, ONE_THOUSAND_TOKENS, false, {from: adminAlice});
    });

    it('can not "add" if not owner', async () => {
      await expectRevert(
        this.staking.add('100', this.xtp.address, ONE_THOUSAND_TOKENS, true, {from: bob}),
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
      await expectRevert(
        this.staking.set(POOL_ZERO, '100', toBn('0'), true, {from: adminAlice}),
        'set: _maxStakingAmountPerUser must be greater than zero'
      );
    });

    it('can "set" with invalid pid', async () => {
      await expectRevert(
        this.staking.set(POOL_ONE, '500', ONE_THOUSAND_TOKENS, true, {from: adminAlice}),
        'set: invalid _pid'
      );
    });

    it('can "set" if owner (with update)', async () => {
      assert.equal((await this.staking.poolInfo(POOL_ZERO))[1].toString(), '100'); // allocPoint

      await this.staking.set(POOL_ZERO, '500', ONE_THOUSAND_TOKENS, true, {from: adminAlice});
      assert.equal((await this.staking.poolInfo(POOL_ZERO))[1].toString(), '500'); // allocPoint
    });

    it('can "set" if owner (without update)', async () => {
      assert.equal((await this.staking.poolInfo(POOL_ZERO))[1].toString(), '100'); // allocPoint

      await this.staking.set(POOL_ZERO, '500', ONE_THOUSAND_TOKENS, false, {from: adminAlice});
      assert.equal((await this.staking.poolInfo(POOL_ZERO))[1].toString(), '500'); // allocPoint
    });

    it('can not "add" or "set" if after completion', async () => {
      await time.advanceBlockTo(this.startBlock.add(toBn('201')));
      await expectRevert(
        this.staking.add('100', this.xtp.address, ONE_THOUSAND_TOKENS, true, {from: adminAlice}),
        'add: must be before end'
      );

      await expectRevert(
        this.staking.set(POOL_ZERO, '100', ONE_THOUSAND_TOKENS, true, {from: adminAlice}),
        'set: must be before end'
      );
    });
  });
});
