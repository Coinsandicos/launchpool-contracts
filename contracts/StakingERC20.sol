pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract StakingERC20 is ERC20 {

    uint256 public constant INITIAL_SUPPLY = 5;

    constructor(string memory name, string memory symbol, address to) public ERC20(name, symbol) {
        _mint(to, INITIAL_SUPPLY * (10 ** uint256(decimals())));
    }
}