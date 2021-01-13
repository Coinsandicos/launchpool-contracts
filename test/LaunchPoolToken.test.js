const {time, BN, expectRevert, constants} = require('@openzeppelin/test-helpers');

const MockERC20 = artifacts.require('MockERC20');
const LaunchPoolToken = artifacts.require('LaunchPoolToken');
const LaunchPoolStaking = artifacts.require('LaunchPoolStaking');

require('chai').should();

const to18DP = (value) => {
  return new BN(value).mul(new BN('10').pow(new BN('18')));
};

contract('LaunchPoolStaking', ([adminAlice, bob, carol, daniel, minter, referer, launchPoolAdmin, whitelister]) => {
  const ONE_THOUSAND_TOKENS = to18DP('1000');
  const TEN_THOUSAND_TOKENS = to18DP('10000');

  const POOL_ZERO = new BN('0');
  const POOL_ONE = new BN('1');

  const rewardLimit = ONE_THOUSAND_TOKENS;

  it('should set correct state variables', async () => {

    const startBlock = '0';
    const endBlock = '100';

    this.launchPoolToken = await LaunchPoolToken.new(ONE_THOUSAND_TOKENS, launchPoolAdmin, adminAlice, {from: adminAlice});
    this.xtp = await MockERC20.new('TAP Token', 'XTP', '10000000000', {from: minter});

    this.staking = await LaunchPoolStaking.new(
      this.launchPoolToken.address,
      rewardLimit,
      startBlock,
      endBlock,
      {from: adminAlice}
    );

    (await this.staking.rewardLimit()).should.be.bignumber.equal(rewardLimit);
    (await this.staking.startBlock()).should.be.bignumber.equal(startBlock);
    (await this.staking.endBlock()).should.be.bignumber.equal(endBlock);

    const blockReward = new BN(rewardLimit).div(new BN(endBlock).sub(new BN(startBlock)));
    (await this.staking.lptPerBlock()).should.be.bignumber.equal(blockReward);
  });

  context('With one token added to the staking pools', () => {

    beforeEach(async () => {
      this.launchPoolToken = await LaunchPoolToken.new(TEN_THOUSAND_TOKENS, launchPoolAdmin, adminAlice, {from: adminAlice});

      // setup initial LP coin
      this.xtp = await makeCoinAndSetupUsers('LPToken', 'XTP');

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
      await this.staking.add('100', this.xtp.address, true, {from: adminAlice});

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
      await this.staking.add('100', this.xtp.address, true, {from: adminAlice});

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
      await this.staking.add('100', this.xtp.address, true, {from: adminAlice});

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
      await this.staking.add('100', this.xtp.address, true, {from: adminAlice});

      // Make another coin for the pool
      this.xrp = await makeCoinAndSetupUsers('XRPPooCoin', 'XRP');
      await this.staking.add('50', this.xrp.address, true, {from: adminAlice});

      // check pool length now
      assert.equal((await this.staking.poolLength()).toString(), '2');

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

    it('should issue reward tokens correctly with 2 people in 2 pools with different allocations in each', async () => {
      // TODO
    });
  });

  context('emergencyWithdraw()', async () => {

    beforeEach(async () => {
      this.launchPoolToken = await LaunchPoolToken.new(TEN_THOUSAND_TOKENS, launchPoolAdmin, adminAlice, {from: adminAlice});

      // setup initial LP coin
      this.xtp = await makeCoinAndSetupUsers('LPToken', 'XTP');

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
      await this.staking.add('100', this.xtp.address, true, {from: adminAlice});

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

  });

  context('withdraw()', async () => {

    beforeEach(async () => {
      this.launchPoolToken = await LaunchPoolToken.new(TEN_THOUSAND_TOKENS, launchPoolAdmin, adminAlice, {from: adminAlice});

      // setup initial LP coin
      this.xtp = await makeCoinAndSetupUsers('LPToken', 'XTP');

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
      await this.staking.add('100', this.xtp.address, true, {from: adminAlice});

      // stake some coins from bob
      await this.xtp.approve(this.staking.address, '1000', {from: bob});
      await this.staking.deposit(POOL_ZERO, '100', {from: bob});

      await time.advanceBlockTo(this.startBlock.add(toBn('110')));

      await expectRevert(
        this.staking.withdraw(POOL_ZERO, '101', {from: bob}), // more than bob deposited
        'withdraw: not good'
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
      await this.staking.add('100', this.xtp.address, true, {from: adminAlice});

      // stake some coins from bob
      await this.xtp.approve(this.staking.address, ONE_THOUSAND_TOKENS, {from: bob});
      await this.staking.deposit(POOL_ZERO, ONE_THOUSAND_TOKENS, {from: bob});

      await time.advanceBlockTo(this.startBlock.add(toBn('110')));

      assert.equal((await this.xtp.balanceOf(bob)).toString(), '0');

      // withdraw all
      await this.staking.withdraw(POOL_ZERO, ONE_THOUSAND_TOKENS, {from: bob});

      assert.equal((await this.xtp.balanceOf(bob)).toString(), ONE_THOUSAND_TOKENS);
    });

  });

  const checkRewards = async (pool, from, lptUserBalance, lptPendingBalance, updatePool = true) => {
    if (updatePool) {
      await this.staking.updatePool(pool, {from});
    }
    assert.equal((await this.launchPoolToken.balanceOf(from)).toString(), to18DP(lptUserBalance).toString());
    assert.equal((await this.staking.pendingLpt(pool, from)).toString(), to18DP(lptPendingBalance).toString());
  };

  const makeCoinAndSetupUsers = async (name, symbol) => {
    const coin = await MockERC20.new(name, symbol, ONE_THOUSAND_TOKENS.mul(new BN('4')), {from: minter});
    await coin.transfer(bob, ONE_THOUSAND_TOKENS, {from: minter});
    await coin.transfer(carol, ONE_THOUSAND_TOKENS, {from: minter});
    await coin.transfer(daniel, ONE_THOUSAND_TOKENS, {from: minter});
    return coin;
  };

  const toBn = (value) => new BN(value);


  // it('should not distribute tokens if no one deposit', async () => {
  //   // 100 per block farming rate starting at block 200 with all issuance ending on block 300
  //   this.chef = await DeFiCasino.new(
  //     this.deFiCasinoToken.address,
  //     TEN_THOUSAND_TOKENS, //mint limit
  //     '200', // start mining
  //     '300', // end mining
  //     whitelister,
  //     {from: adminAlice}
  //   );
  //
  //   await this.deFiCasinoToken.changeMinter(this.chef.address, {from: adminAlice});
  //
  //   await this.chef.whitelistStakingToken(this.xtp.address, '100', false, true, {from: adminAlice});
  //   const stakeTokenInternalId = await this.chef.stakingTokenAddressToInternalId(this.xtp.address);
  //
  //   await time.advanceBlockTo('199');
  //   assert.equal((await this.chef.rewardTokensAccrued()).toString(), '0');
  //
  //   await time.advanceBlockTo('204');
  //   assert.equal((await this.chef.rewardTokensAccrued()).toString(), '0');
  //
  //   await this.xtp.approve(this.chef.address, ONE_THOUSAND_TOKENS, {from: bob});
  //   await time.advanceBlockTo('209');
  //   const depositAmount = new BN('10');
  //   await this.chef.deposit(stakeTokenInternalId, depositAmount, referer, {from: bob}); // block 210
  //
  //   assert.equal((await this.chef.rewardTokensAccrued()).toString(), '0');
  //   assert.equal((await this.deFiCasinoToken.balanceOf(bob)).toString(), '0');
  //   assert.equal((await this.deFiCasinoToken.balanceOf(dev)).toString(), '0');
  //   (await this.xtp.balanceOf(bob)).should.be.bignumber.equal(ONE_THOUSAND_TOKENS.sub(depositAmount));
  //
  //   await time.advanceBlockTo('219');
  //   await this.chef.withdraw(stakeTokenInternalId, depositAmount, {from: bob}); // block 220
  //
  //   (await this.chef.rewardTokensAccrued()).should.be.bignumber.equal(ONE_THOUSAND_TOKENS);
  //   (await this.deFiCasinoToken.balanceOf(bob)).should.be.bignumber.equal(ONE_THOUSAND_TOKENS.div(new BN('100')).mul(new BN('80')));
  //   (await this.deFiCasinoToken.balanceOf(referer)).should.be.bignumber.equal(ONE_THOUSAND_TOKENS.div(new BN('100')).mul(new BN('20')));
  //   (await this.xtp.balanceOf(bob)).should.be.bignumber.equal(ONE_THOUSAND_TOKENS);
  //
  //   // all 1k tokens accrued will have been withdrawn so chef should have nothing
  //   (await this.deFiCasinoToken.balanceOf(this.chef.address)).should.be.bignumber.equal('0');
  // });
  //
  // it('should distribute tokens properly for each staker', async () => {
  //   // 100 per block farming rate starting at block 300 with all issuance ending on block 400
  //   this.chef = await DeFiCasino.new(
  //     this.deFiCasinoToken.address,
  //     TEN_THOUSAND_TOKENS,
  //     '300',
  //     '400',
  //     whitelister,
  //     {from: adminAlice}
  //   );
  //
  //   await this.deFiCasinoToken.changeMinter(this.chef.address, {from: adminAlice});
  //
  //   await this.chef.whitelistStakingToken(this.xtp.address, '100', false, true, {from: adminAlice});
  //   const stakeTokenInternalId = await this.chef.stakingTokenAddressToInternalId(this.xtp.address);
  //
  //   await this.xtp.approve(this.chef.address, ONE_THOUSAND_TOKENS, {from: adminAlice});
  //   await this.xtp.approve(this.chef.address, ONE_THOUSAND_TOKENS, {from: bob});
  //   await this.xtp.approve(this.chef.address, ONE_THOUSAND_TOKENS, {from: carol});
  //
  //   // Alice deposits 10 LPs at block 310
  //   await time.advanceBlockTo('309');
  //   const aliceFirstDeposit = to18DP('100');
  //   await this.chef.deposit(stakeTokenInternalId, aliceFirstDeposit, referer, {from: adminAlice});
  //
  //   // Bob deposits 20 LPs at block 314
  //   await time.advanceBlockTo('313');
  //   const bobFirstDeposit = to18DP('200');
  //   await this.chef.deposit(stakeTokenInternalId, bobFirstDeposit, referer, {from: bob});
  //
  //   // at block 314, 400 tokens will have been issued - all which should be due to adminAlice
  //   const FOUR_HUNDRED = to18DP('400');
  //   assert.equal((await this.chef.rewardTokensAccrued()).toString(), FOUR_HUNDRED);
  //
  //   // Carol deposits 30 LPs at block 318
  //   await time.advanceBlockTo('317');
  //   const carolFirstDeposit = to18DP('300');
  //   await this.chef.deposit(stakeTokenInternalId, carolFirstDeposit, referer, {from: carol});
  //
  //   assert.equal((await this.chef.rewardTokensAccrued()).toString(), FOUR_HUNDRED.mul(new BN('2')));
  //
  //   (await this.deFiCasinoToken.balanceOf(this.chef.address)).should.be.bignumber.equal(FOUR_HUNDRED.mul(new BN('2')));
  //
  //   // Alice deposits 10 more LPs at block 320.
  //   await time.advanceBlockTo('319');
  //   const aliceSecondDeposit = to18DP('100');
  //   await this.chef.deposit(stakeTokenInternalId, aliceSecondDeposit, referer, {from: adminAlice});
  //
  //   assert.equal((await this.chef.rewardTokensAccrued()).toString(), ONE_THOUSAND_TOKENS);
  //
  //   //As of block #320:
  //   //   Alice should have:
  //   //     - from the first 4 blocks (#314 - when bob deposits): 4 blocks * 100 reward per block = 400
  //   //     - from the next 4 blocks (#318 - when carol deposits): 4 * 1/3 * 100 (1/3 of the share of the reward token based on deposits thus far) = 133.33
  //   //     - block #320 when Alice adds 10 more LPs: 2 * 1/6 * 100 = 33.33
  //   //     - total = 400 + 133.33 + 33.33
  //   //     HOWEVER, Alice only gets 80% of the total vs 20% for her referer
  //   const TWO_HUNDRED = to18DP('200');
  //   const first4BlockReward = FOUR_HUNDRED;
  //   const next4BlockReward = FOUR_HUNDRED.div(new BN('3'));
  //   const next2BlockReward = TWO_HUNDRED.div(new BN('6'));
  //   const aliceTotal = first4BlockReward.add(next4BlockReward).add(next2BlockReward);
  //   const aliceTotalMinusReferralShare = aliceTotal.div(new BN('100')).mul(new BN('80'));
  //   const referralShare = aliceTotal.div(new BN('100')).mul(new BN('20'));
  //
  //   (await this.deFiCasinoToken.balanceOf(adminAlice)).should.be.bignumber.equal(aliceTotalMinusReferralShare);
  //   (await this.deFiCasinoToken.balanceOf(referer)).should.be.bignumber.equal(referralShare);
  //
  //   assert.equal((await this.deFiCasinoToken.balanceOf(bob)).toString(), '0');
  //   assert.equal((await this.deFiCasinoToken.balanceOf(carol)).toString(), '0');
  //
  //   (await this.deFiCasinoToken.balanceOf(this.chef.address)).should.be.bignumber.equal(ONE_THOUSAND_TOKENS.sub(aliceTotalMinusReferralShare.add(referralShare)));
  //
  //   // Bob withdraws 5 LPs at block 330. At this point:
  //   //   Bob should have: 4 * 2/3 * 100 + 2 * 2/6 * 100 + 10 * 2/7 * 100
  //   await time.advanceBlockTo('329');
  //   const bobFirstWithdrawal = to18DP('5');
  //   await this.chef.withdraw(stakeTokenInternalId, bobFirstWithdrawal, {from: bob});
  //
  //   (await this.chef.rewardTokensAccrued()).should.be.bignumber.equal(ONE_THOUSAND_TOKENS.mul(new BN('2')));
  //   (await this.deFiCasinoToken.balanceOf(adminAlice)).should.be.bignumber.equal(aliceTotalMinusReferralShare);
  //
  //   //   Bob should have: 4 * 2/3 * 100 + 2 * 2/6 * 100 + 10 * 2/7 * 100
  //   const firstRewardBob = FOUR_HUNDRED.mul(new BN('2')).div(new BN('3'));
  //   const secondRewardBob = TWO_HUNDRED.div(new BN('3'));
  //   const thirdRewardBob = ONE_THOUSAND_TOKENS.mul(new BN('2')).div(new BN('7'));
  //   const bobTotalReward = firstRewardBob.add(secondRewardBob).add(thirdRewardBob);
  //   //(await this.deFiCasinoToken.balanceOf(bob)).should.be.bignumber.equal(bobTotalReward);
  //
  //   assert.equal((await this.deFiCasinoToken.balanceOf(carol)).toString(), '0');
  //   // assert.equal((await this.deFiCasinoToken.balanceOf(this.chef.address)).toString(), '8815');
  //   //
  //   // // Alice withdraws 20 LPs at block 340.
  //   // // Bob withdraws 15 LPs at block 350.
  //   // // Carol withdraws 30 LPs at block 360.
  //   // await time.advanceBlockTo('339');
  //   // await this.chef.withdraw('20', {from: adminAlice});
  //   // await time.advanceBlockTo('349');
  //   // await this.chef.withdraw('15', {from: bob});
  //   // await time.advanceBlockTo('359');
  //   // await this.chef.withdraw('30', {from: carol});
  //   //
  //   // assert.equal((await this.chef.rewardTokensAccrued()).toString(), '5000');
  //   //
  //   // // FIXME rounding error? 1 wei out?
  //   // assert.equal((await this.deFiCasinoToken.balanceOf(this.chef.address)).toString(), '5001');
  //   //
  //   // // Alice should have: 566 + (10 * 2/7 * 100)+ (10 * 2/6.5 * 100) = 1159
  //   // assert.equal((await this.deFiCasinoToken.balanceOf(adminAlice)).toString(), '1159');
  //   //
  //   // // Bob should have: 619 + (10 * 1.5/6.5 * 100) + (10 * 1.5/4.5 * 100) = 1183
  //   // assert.equal((await this.deFiCasinoToken.balanceOf(bob)).toString(), '1183');
  //   //
  //   // // Carol should have: (2* 3/6 *100) + (10* 3/7 *100) + (10* 3/6.5 *100) + (10* 3/4.5 *100) + 10*100 = 2657
  //   // assert.equal((await this.deFiCasinoToken.balanceOf(carol)).valueOf(), '2657');
  //   //
  //   // // FIXME rounding error? 1 wei out?
  //   // assert.equal(1159 + 1183 + 2657, 4999);
  //   //
  //   // // All of them should have 1000 LPs back.
  //   // assert.equal((await this.xtp.balanceOf(adminAlice)).valueOf(), '1000');
  //   // assert.equal((await this.xtp.balanceOf(bob)).valueOf(), '1000');
  //   // assert.equal((await this.xtp.balanceOf(carol)).valueOf(), '1000');
  // });
  //
  // it('should stop giving bonus tokens after the end of the farming period', async () => {
  //   // 100 token block reward starting at block 500 and finishing at block 600
  //   this.chef = await DeFiCasino.new(
  //     this.deFiCasinoToken.address,
  //     '10000',
  //     '500',
  //     '600',
  //     whitelister,
  //     {from: adminAlice}
  //   );
  //
  //   await this.deFiCasinoToken.changeMinter(this.chef.address, {from: adminAlice});
  //
  //   await this.chef.whitelistStakingToken(this.xtp.address, '100', false, true,{from: adminAlice});
  //   const stakeTokenInternalId = await this.chef.stakingTokenAddressToInternalId(this.xtp.address);
  //
  //   // Alice deposits 10 LPs at block 590
  //   await this.xtp.approve(this.chef.address, '1000', {from: adminAlice});
  //   await time.advanceBlockTo('589');
  //   await this.chef.deposit(stakeTokenInternalId, '10', referer, {from: adminAlice});
  //
  //   // At block 605, she should have 10 blocks * 100 token per block reward = 1000 pending.
  //   await time.advanceBlockTo('605');
  //   const {
  //     _userRewards,
  //     _referrerRewards
  //   } = await this.chef.pendingRewards(stakeTokenInternalId, adminAlice);
  //   assert.equal(_userRewards.toString(), '800');
  //   assert.equal(_referrerRewards.toString(), '200');
  //
  //   // At block 606, Alice withdraws all pending rewards and should get 1000 tokens (no more than block 605 as token rewards ended on block 600).
  //   await this.chef.harvest(stakeTokenInternalId, {from: adminAlice});
  //   assert.equal((await this.chef.pendingRewards(stakeTokenInternalId, adminAlice))._userRewards.toString(), '0');
  //   assert.equal((await this.deFiCasinoToken.balanceOf(adminAlice)).toString(), '800');
  // });

  describe('owner functions', () => {

    const startBlock = '0';
    const endBlock = '100';

    beforeEach(async () => {
      this.launchPoolToken = await LaunchPoolToken.new(ONE_THOUSAND_TOKENS, launchPoolAdmin, adminAlice, {from: adminAlice});

      this.xtp = await makeCoinAndSetupUsers('LPToken', 'XTP');

      this.staking = await LaunchPoolStaking.new(
        this.launchPoolToken.address,
        rewardLimit,
        startBlock,
        endBlock,
        {from: adminAlice}
      );
    });

    it('can not "add" if not owner', async () => {
      await expectRevert(
        this.staking.add('100', this.xtp.address, true, {from: bob}),
        'Ownable: caller is not the owner'
      );
    });

    it('can not "set" if not owner', async () => {
      await expectRevert(
        this.staking.set(POOL_ZERO, '100', true, {from: bob}),
        'Ownable: caller is not the owner'
      );
    });
  });
});
