We provide a couple of 'hardhat' tasks (defined in 'tasks' folder) that can help you to interact with contracts.

You can run `npx hardhat --help` to see all tasks. We will only explain the tasks we provide(not the hardhat builtin tasks) on this page.

For all the commands listed below, you at least need to configure '_RPC' in `.env` file for the network you want to interact with.

> NOTE: You can make a copy from `.env.example` as your `.env`.

Let's use walkthrough those using Base Sepolia network.


## Deploy


For deploying contracts, we have:
- `npx hardhat deploy-mock-token`, for testing
- `npx hardhat deploy-factory`
- `npx hardhat deploy-clone`
- `npx hardhat deploy-safe`

And to use those commands, you need to configure 'PK' or 'MNEMONIC' in `.env` file.

> NOTE:
>
> use `--help` for arguments and flags.
>
> use `--network` to deploy on specific network; you need to have the network configured in hardhat.config.ts first.


### Deploy test token

If you have an erc20 token contract already deployed, you can skip this step.

For demo purpose, we'll deploy a mock erc20 token KMT.

Run `npx hardhat --network baseSepolia deploy-mock-token`, you'll get output like :
```
Current network: baseSepolia/84532
Current height:  23364165
>>>
MockToken deployed: 0xdE6A3f576d38F5A31CDD59F798606d8F523270d8
```

> `--network baseSepolia` specifies the blockchain network we want to use, 'baseSepolia' is the same name we use in 'hardhat.config.ts' file.
> We'll use this flag for all our tasks below.

### Deploy safe wallet(optional)

If you already have a Gnosis Safe wallet and want to use it as your multi-sign wallet, you can skip this step.

A Gnosis Safe wallet is used as the admin role to make state change to our escrow(RewardDistributor) contract.

Let's say we have two wallets 0x640568976c2CDc8789E44B39369D5Bc44B1e6Ad7 and 0x9AB44C3Ac7D26b15A96cE35a03066b88CFbD8b8B, and we want just one confirmation from either wallet to execute any transaction, we can run
`npx hardhat --network baseSepolia deploy-safe 1 0x640568976c2CDc8789E44B39369D5Bc44B1e6Ad7 0x9AB44C3Ac7D26b15A96cE35a03066b88CFbD8b8B`, you'll get output like:
```
Current network: baseSepolia/84532
Current height:  23366011
>>>
Owners:  [
  '0x640568976c2CDc8789E44B39369D5Bc44B1e6Ad7',
  '0x9AB44C3Ac7D26b15A96cE35a03066b88CFbD8b8B'
]
Threshold:  1
Safe Version:  1.4.1
Predicted Safe Address:  0xB712073aaC7f6d4178c1289Cf97aE3195a48bA4a
>>>
Transaction hash: 0x0b264fa3a8d4f378d7b3208d816e4c9225fd3aca0c8422d3786e1bbd01bf832e
Is Safe deployed: true
Safe Address: 0xB712073aaC7f6d4178c1289Cf97aE3195a48bA4a
Safe Owners: [
  '0x640568976c2CDc8789E44B39369D5Bc44B1e6Ad7',
  '0x9AB44C3Ac7D26b15A96cE35a03066b88CFbD8b8B'
]
Safe Threshold: 1

```

> NOTE: You can also do this using Safe's frontend; if you do, please don't enable 'ERC4337' module.


### Deploy the singleton&factory contracts

The first step we deploy our escrow(RewardDistributor) contract is to deploy the singleton and factory contract. The 'singleton' contract is a template contract and needs to be deployed first, so 'factory' can create new 'clone' from it with different parameters.

And to do this, we can run `npx hardhat --network baseSepolia deploy-factory`, you'll get output like :
```
Current network: baseSepolia/84532
Current height:  23364350
Deployer/Owner address:  0x640568976c2CDc8789E44B39369D5Bc44B1e6Ad7
>>>
Singleton contract deployed to: 0x6c006767a66C081F63C6c693189d0A5863B7397f
Factory Contract deployed to: 0xd888D2934f127a2b3382ef64E8548676AE57a802
```

### Deploy a new clone contract

> The tasks we run above will also create a directory 'ignition/chain-84532', and 'deployed_addresses.json' has all our deployed contract addresses.

With our singleton&factory contracts deployed, we can now create a new clone(RewardDistributor) contract.
In this demo, we want to use the KMT erc20 token as our reward token, and the Safe wallet we just deployed as our safe, so we run
`npx hardhat --network baseSepolia deploy-clone 0xB712073aaC7f6d4178c1289Cf97aE3195a48bA4a 0xdE6A3f576d38F5A31CDD59F798606d8F523270d8`, and you'll get output like :
```
Current network: baseSepolia/84532
Current height:  23366212
>>>
Deployer/Owner address:  0x640568976c2CDc8789E44B39369D5Bc44B1e6Ad7
Target Factory Address: 0xd888D2934f127a2b3382ef64E8548676AE57a802
Safe Address: 0xB712073aaC7f6d4178c1289Cf97aE3195a48bA4a
Init Fee: 0.0001 eth
Token Address: 0xdE6A3f576d38F5A31CDD59F798606d8F523270d8
Salt Nonce: 0xf54354f8de81407f116766172f3761205c8571d482c3f59b1ca94a58d88b3b30
>>>
Escrow Contract deployed to:  0xA8bE7110Ad15582f8394aB56C299c7bf297e7208
```

This command will use deployed singleton and factory contract address for network 'baseSepolia', and a default 0.0001 'poster fee'. use `npx hardhat --network baseSepolia deploy-clone --help` to see all options.

> NOTE: Do not use rebasing token.
>
> 'deployed_addresses.json' won't save 'clone' contract address, please write it down somewhere.

## Verify contracts

Hardhat provides a builtin task to verify contracts, you'll need to either config 'ETHERSCAN_API_KEY' in `.env` file, or add 'customChains' in `hardhat.config.ts` file like we've already did for 'base-sepolia'.

Once you have everything configured,

`npx hardhat --network baseSepolia verify`

## Other utility tasks

### Verify contracts

Check https://hardhat.org/hardhat-runner/plugins/nomicfoundation-hardhat-verify

### Check escrow contract info

`npx hardhat --network baseSepolia show-escrow 0xA8bE7110Ad15582f8394aB56C299c7bf297e7208`, will give you :
```
Current network: baseSepolia/84532
Current height:  23366541
PosterFee: 0.0001 eth
RewardToken: 0xdE6A3f576d38F5A31CDD59F798606d8F523270d8
RewardToken Name: KwilMockToken
RewardToken Symbol: KMT
RewardToken Decimals: 18
Safe Address: 0xB712073aaC7f6d4178c1289Cf97aE3195a48bA4a
Is Safe deployed: true
Safe Owners: [
  '0x640568976c2CDc8789E44B39369D5Bc44B1e6Ad7',
  '0x9AB44C3Ac7D26b15A96cE35a03066b88CFbD8b8B'
]
Safe Threshold: 1
```

### Transfer erc20 token

`npx hardhat --network baseSepolia transfer-token --help`

### Claim rewards

Once you have some rewards on Kwil network, you can run `kwil-cli call-action list_wallet_rewards -n rewards text:YOUR_WALLET_ADDR bool:false` to get the parameters you need to claim the rewards.

The parameters you get can be used on this command `npx hardhat --network baseSepolia claim-rewards --help`.