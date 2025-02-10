# RewardDistributor Smart Contract

## Overview

The `RewardDistributor` is a smart contract designed to securely distribute ERC20 token rewards to eligible recipients. The contract utilizes a Merkle tree for efficient verification of reward claims and requires a [Safe Wallet](https://safe.global/wallet) for posting rewards, updating the fees, and managing signers.

`RewardDistributor` is implemented as a [minimal proxy contract](https://eips.ethereum.org/EIPS/eip-1167), and will be created/deployed through a factory using OpenZeppelin [cloneDeterministic](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/441dc141ac99622de7e535fa75dfc74af939019c/contracts/proxy/Clones.sol#L74).

### Key Features

- **Reward Distribution via Merkle Trees**: This allows multiple recipients to claim rewards based on their inclusion in a Merkle tree.
- **Multisig Signer Approval**: Distributing rewards requires multisign from Safe wallet.
- **Poster Fee Mechanism**: A small fee is paid by claimants to the individual who posts the reward root (the `PosterService`) to offset the gas fees spent distributing rewards.

### Limitations

- [Rebasing ERC20 token](https://cointelegraph.com/explained/what-are-rebase-tokens-and-how-do-they-work) cannot be used as the reward token
- Safe cannot operate in ERC4337 compatible mode

## Different roles involved

- SignerService: Kwil network reward signer service. It manages individual signatures for the SAFE wallet and uploads signatures to a Kwil database (to be used be `Poster Service`). Learn more about Kwil [here](https://docs.kwil.com).
- Safe: Safe wallet that has admin privileges to update a contract's state, through `postReward`/`updatePosterFee`.
- PosterService: A service that uses transactions from `SignerService` to propose/confirm/execute transactions through Safe to this contract.
- User: A wallet which is able to claim reward through `claimReward`, providing proofs.

NOTE: A diagram of the workflow is available in [README](../README.md).

## Contract Components

### Safe Wallet

The Safe wallet acts as the administrator to:

- Post rewards
- Update poster fee
- Update signer list (through Safe directly)

### Reward Posting

Rewards are posted using a Merkle root, which represents the entire set of eligible reward recipients and their amounts. The poster of the reward root is paid a small fee by claimants when they claim their rewards.

- **Reward Roots**: A mapping of posted reward roots to the addresses that submitted them.
- **Poster Reward**: A fee (in wei) paid to the poster of a reward root by claimants when they claim their reward.

> A reward in this contract is the aggregation of multiple rewards in a Kwil epoch (the discreet period in which rewards are accumulated);
> a merkle tree is generated from those rewards, and it's referenced by the merkle tree root. In contract, we store the root of the tree.

### Claiming Rewards

Recipients can claim their rewards by providing a valid Merkle proof that verifies their inclusion in the posted reward tree. The contract handles the transfer of rewards and ensures the reward has not already been claimed.

- **Merkle Proof Verification**: Ensures the reward claim is valid by verifying the recipient's inclusion in the Merkle tree.

### Poster Reward Fee

The contract allows for the adjustment of the reward fee paid to the poster of a reward root. This requires multisig approval and ensures the fee remains fair and adjustable as necessary.

## Usage

### 1. Posting a Reward Root

To post a reward root, an authorized individual must collect signatures from the required number of signers. The reward root, along with the total amount of tokens to be distributed, is submitted to the contract. The contract verifies the signatures and ensures the reward amount does not exceed the contract’s token balance.

### 2. Claiming a Reward
A recipient claims their reward by providing a Merkle proof that verifies their entitlement. The contract checks the validity of the proof and, if valid, transfers the tokens to the recipient. The recipient pays the wallet who posted the Merkle root in Ether when they withdraw.

### 3. Updating the Poster Reward Fee
The poster reward fee can be updated via a multisig process. Once enough signers have approved, the fee is changed, and an event is emitted.