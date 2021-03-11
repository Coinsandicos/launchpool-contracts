const {time, BN, expectRevert, constants} = require('@openzeppelin/test-helpers');

const Guild = artifacts.require('Guild');

require('chai').should();

contract('Guild', ([deployer, token, stakingContract, ...otherAccounts]) => {

  beforeEach(async () => {
    this.guild = await Guild.new(token, stakingContract)
  })

  describe('withdrawTo', () => {
    it('Reverts if not staking contract', async () => {
      await expectRevert(
        this.guild.withdrawTo(deployer, '5', {from: deployer}),
        "Guild.withdrawTo: Only staking contract"
      )
    })
  })
})
