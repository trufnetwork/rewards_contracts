# RewardDistributor Smart Contract

## Overview

The `RewardDistributor` is a smart contract designed to securely distribute ERC20 token rewards to eligible recipients. The contract utilizes a Merkle tree for efficient verification of reward claims and requires a GnosisSafe wallet for posting rewards, updating the fees, and managing signers.

### Key Features

- **Reward Distribution via Merkle Trees**: This allows multiple recipients to claim rewards based on their inclusion in a Merkle tree.
- **Multisig Signer Approval**: Key actions require multisign from GnosisSafe wallet.
- **Poster Fee Mechanism**: A small fee is paid by claimants to the individual who posts the reward root, to offset the gas fees spent distributing rewards.

## Different roles involved

- SignerService: Kwil network reward signer service. It signs new reward on Kwil network, and upload the signature
  onto Kwil network, which later will be used by PosterService to propose/comfirm/execute txs through GnosisSafe.
- Safe: GnosisSafe wallet. It's the admin role to update contract's state, through `postReward`/`updatePosterFee`.
- PosterService: A service dedicated to pose transactions through GnosisSafe to this contract.
- User: A wallet which is able to claim reward through `claimReward`, providing proofs.

NOTE: A diagram of the workflow is available in [README](../README.md).

## Contract Components

### GnosisSafe Wallet

The GnosisSafe wallet acts admin to:
- post reward
- update poster fee
- update signer list (through GnosisSafe directly)

### Reward Posting

Rewards are posted using a Merkle root, which represents the entire set of eligible reward recipients and their amounts. The poster of the reward root is paid a small fee by claimants when they claim their rewards.

- **Reward Roots**: A mapping of posted reward roots to the addresses that submitted them.
- **Poster Reward**: A fee (in gwei) paid to the poster of a reward root by claimants when they claim their reward.

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