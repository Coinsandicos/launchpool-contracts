// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FundRaisingGuild {

    address public stakingContract;

    constructor(address _stakingContract) public {
        stakingContract = _stakingContract;
    }

    function withdrawTo(IERC20 _token, address _recipient, uint256 _amount) external {
        require(msg.sender == stakingContract, "Guild.withdrawTo: Only staking contract");
        require(_token.transfer(_recipient, _amount), "Guild.withdrawTo: Transfer failed");
    }

    function tokenBalance(IERC20 _token) external returns (uint256) {
        return _token.balanceOf(address(this));
    }
}
