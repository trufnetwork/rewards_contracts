# Upgradeable Contract Deployment Tasks

We provide Hardhat tasks for deploying and managing upgradeable RewardDistributor contracts. These allow you to upgrade contract logic while preserving all state and the same contract address.

You can run `npx hardhat --help` to see all tasks. This guide covers the upgradeable-specific tasks.

For all commands below, you need to configure `_RPC` in `.env` file for your target network.

> **NOTE**: You can copy from `.env.example` as your `.env`.

Let's walk through deployment using Sepolia network.

## Deploy Upgradeable Contracts

For deploying upgradeable contracts, we have:
- `npx hardhat deploy-upgradeable-factory` - Deploy implementation and factory
- `npx hardhat deploy-upgradeable-proxy` - Deploy an upgradeable proxy
- `npx hardhat deploy-new-implementation` - Deploy new implementation only

You need to configure `PK` or `MNEMONIC` in `.env` file for deployment.

> **NOTE**: 
> - Use `--help` for arguments and flags
> - Use `--network` to deploy on specific network
> - These contracts are UPGRADEABLE unlike the clone pattern

### 1. Deploy Test Token (Optional)

If you have an erc20 token contract already deployed, you can skip this step.

For demo purpose, we'll deploy a mock erc20 token KMT.

Run `npx hardhat --network sepolia deploy-mock-token`, you'll get output like:
```
Current network: sepolia/11155111
Current height: 5234000
>>>
MockToken deployed: 0xdE6A3f576d38F5A31CDD59F798606d8F523270d8
```

### 2. Deploy Safe Wallet (Optional)

If you already have a Gnosis Safe wallet and want to use it as your multi-sign wallet, you can skip this step.

A Gnosis Safe wallet is used as the admin role to make state changes to our escrow(RewardDistributor) contract and authorize upgrades.

Let's say we have two wallets 0x640568976c2CDc8789E44B39369D5Bc44B1e6Ad7 and 0x9AB44C3Ac7D26b15A96cE35a03066b88CFbD8b8B, and we want just one confirmation from either wallet to execute any transaction, we can run:

`npx hardhat --network sepolia deploy-safe 1 0x640568976c2CDc8789E44B39369D5Bc44B1e6Ad7 0x9AB44C3Ac7D26b15A96cE35a03066b88CFbD8b8B`

You'll get output like:
```
Current network: sepolia/11155111
Current height: 5234050
>>>
Owners: [
  '0x640568976c2CDc8789E44B39369D5Bc44B1e6Ad7',
  '0x9AB44C3Ac7D26b15A96cE35a03066b88CFbD8b8B'
]
Threshold: 1
Safe Version: 1.4.1
Predicted Safe Address: 0xB712073aaC7f6d4178c1289Cf97aE3195a48bA4a
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

> **NOTE**: You can also do this using Safe's frontend; if you do, please don't enable 'ERC4337' module.

### 3. Deploy Upgradeable Implementation & Factory

Deploy the upgradeable implementation and factory contracts:

```bash
npx hardhat --network sepolia deploy-upgradeable-factory
```

You'll get output like:
```
Current network: sepolia/11155111
Current height: 5234567
Deployer/Owner address: 0x640568976c2CDc8789E44B39369D5Bc44B1e6Ad7
>>> 
Deploying RewardDistributor implementation...
Implementation contract deployed to: 0x6c006767a66C081F63C6c693189d0A5863B7397f
Deploying RewardDistributorFactory...
Factory contract deployed to: 0xd888D2934f127a2b3382ef64E8548676AE57a802
>>> 
Deployment completed!
Implementation: 0x6c006767a66C081F63C6c693189d0A5863B7397f
Factory: 0xd888D2934f127a2b3382ef64E8548676AE57a802
```

**⚠️ Important**: Save these addresses! You'll need them for creating proxies and upgrades.

### 4. Deploy Upgradeable Proxy

With your implementation and factory deployed, create an upgradeable proxy:

```bash
npx hardhat --network sepolia deploy-upgradeable-proxy \
  --factory 0xFACTORY_ADDRESS \
  0xSAFE_ADDRESS \
  0xTOKEN_ADDRESS
```

Where:
- `--factory` is your deployed factory address
- First parameter is your Safe wallet address
- Second parameter is your ERC20 token address

You'll get output like:
```
Current network: sepolia/11155111
Current height: 5234678
>>> 
Deployer/Owner address: 0x640568976c2CDc8789E44B39369D5Bc44B1e6Ad7
Target Factory Address: 0xd888D2934f127a2b3382ef64E8548676AE57a802
Safe Address: 0xB712073aaC7f6d4178c1289Cf97aE3195a48bA4a
Init Fee: 0.0001 eth
Token Address: 0xdE6A3f576d38F5A31CDD59F798606d8F523270d8
Salt Nonce: 0xf54354f8de81407f116766172f3761205c8571d482c3f59b1ca94a58d88b3b30
Predicted Proxy Address: 0xA8bE7110Ad15582f8394aB56C299c7bf297e7208
>>> 
Transaction hash: 0x1234...
Transaction confirmed in block: 23366213
>>> 
Upgradeable Proxy deployed to: 0xA8bE7110Ad15582f8394aB56C299c7bf297e7208
Contract's safe: 0xB712073aaC7f6d4178c1289Cf97aE3195a48bA4a
Contract's posterFee: 100000000000000
Contract's rewardToken: 0xdE6A3f576d38F5A31CDD59F798606d8F523270d8
Contract's initial token balance: 0
>>> 
IMPORTANT: This is an upgradeable proxy!
- Proxy address will remain the same across upgrades
- Only the Safe wallet can authorize upgrades
- Use 'upgrade-proxy' task to upgrade implementation
```

## Safe Wallet Upgrades

When your proxy is controlled by a Safe wallet, you **cannot** upgrade directly using the command line. Safe contracts require upgrades to be executed through their web interface.

### Generate Safe Transaction Data

Use this task to generate the transaction data needed for the Safe web interface:

```bash
npx hardhat --network sepolia generate-safe-upgrade-data \
  0xYOUR_PROXY_ADDRESS \
  0xNEW_IMPLEMENTATION_ADDRESS
```

Output:
```
=== SAFE TRANSACTION DATA ===

Proxy Address: 0xYOUR_PROXY_ADDRESS
New Implementation: 0xNEW_IMPLEMENTATION_ADDRESS
Additional Calldata: 0x

=== COPY THESE VALUES TO SAFE WEB INTERFACE ===

To Address: 0xYOUR_PROXY_ADDRESS
ETH Value: 0
Data (hex): 0x4f1ef286000000000000000000000000NEW_IMPLEMENTATION_ADDRESS00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000

=== INSTRUCTIONS ===
1. Go to Safe web interface
2. Create new transaction
3. Paste the 'To Address' above
4. Set ETH Value to 0
5. Paste the 'Data (hex)' above
6. Submit and execute the transaction

This will upgrade your proxy to the new implementation!
```

### Steps for Safe Upgrade

1. **Deploy new implementation** (if not done already):
   ```bash
   npx hardhat --network sepolia deploy-new-implementation
   ```

2. **Generate transaction data**:
   ```bash
   npx hardhat --network sepolia generate-safe-upgrade-data \
     0xYOUR_PROXY_ADDRESS \
     0xNEW_IMPLEMENTATION_ADDRESS
   ```

3. **Execute via Safe web interface**:
   - Go to your Safe at https://app.safe.global/
   - Create a new transaction
   - Use the "To Address", "ETH Value", and "Data" from the task output
   - Submit and execute the transaction

4. **Verify the upgrade**:
   - Check that the implementation slot has been updated
   - Verify all state is preserved (safe, posterFee, rewardToken)
   - Test basic functionality


## Key Differences from Clone Pattern

| Feature | Clone Pattern | Upgradeable Pattern |
|---------|---------------|-------------------|
| **Deployment** | Cheap minimal proxies | More expensive full proxies |
| **Address** | New address per clone | Same address across upgrades |
| **Upgrades** | ❌ Not possible | ✅ Authorized upgrades |
| **State** | ❌ Lost on new deployment | ✅ Preserved across upgrades |
| **Gas Cost** | Lower | Higher |
| **Flexibility** | Limited | High |

## Security Notes

- **Only Safe wallet can upgrade**: Upgrades require authorization from the Safe wallet set during initialization
- **State preservation**: All mappings, balances, and settings remain intact during upgrades
- **Implementation validation**: New implementations are validated before upgrade
- **Event tracking**: All upgrades emit events for transparency

## Verification

For upgradeable contracts, you need to verify **three separate contracts**: implementation, factory, and proxy.

### Prerequisites

Configure `ETHERSCAN_API_KEY` in your `.env` file:
```bash
ETHERSCAN_API_KEY=your_api_key_here
```

### Verification Commands

```bash
# Implementation (no args)
npx hardhat verify --network sepolia 0xIMPLEMENTATION_ADDRESS

# Factory (2 args)
npx hardhat verify --network sepolia 0xFACTORY_ADDRESS \
  "0xOWNER_ADDRESS" "0xIMPLEMENTATION_ADDRESS"
