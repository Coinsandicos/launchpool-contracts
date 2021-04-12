## Launchpool Smart Contracts


### install

`npm install`

### compile

`npx hardhat compile`

### test

Run all tests

`npx hardhat test`

### coverage

Unit test coverage

`npx hardhat coverage`

### Deploy / Scripts

Require two environment variables for testnet and mainnet deployments:

```
process.env.INFURA_PROJECT_ID
process.env.PRIVATE_KEY
```

`PRIVATE_KEY` being the private key of the Ethereum account to use for running the scripts

An example script can be ran like so:

`npx hardhat run ./scripts/x_sanity_check_phase_2_pools.js --network mainnet`

If you need to verify via the etherscan hardhat plugin then please set:

```
process.env.ETHERSCAN_KEY
```

