# RewardDistributor Smart Contract

## Overview

The `RewardDistributor` is a smart contract designed to securely distribute ERC20 token rewards to eligible recipients. The contract utilizes a Merkle tree for efficient verification of reward claims and requires multisig approval for posting rewards, updating the fees, and managing signers.

### Key Features

- **Reward Distribution via Merkle Trees**: This allows multiple recipients to claim rewards based on their inclusion in a Merkle tree.
- **Multisig Signer Approval**: Key actions require signatures from a threshold of approved signers to ensure security and decentralization.
- **Poster Fee Mechanism**: A small fee is paid by claimants to the individual who posts the reward root, to offset the gas fees spent distributing rewards.

## Contract Components

### Signer Management

The contract maintains a list of signers who are authorized to approve certain actions. These signers are required to collectively authorize updates or postings within the contract.

- **Signers**: An array of addresses representing the allowed signers.
- **Threshold**: The minimum number of signatures required to approve an action.

### Reward Posting

Rewards are posted using a Merkle root, which represents the entire set of eligible reward recipients and their amounts. The poster of the reward root is paid a small fee by claimants when they claim their rewards.

- **Reward Roots**: A mapping of posted reward roots to the addresses that submitted them.
- **Poster Reward**: A fee (in gwei) paid to the poster of a reward root by claimants when they claim their reward.

### Claiming Rewards

Recipients can claim their rewards by providing a valid Merkle proof that verifies their inclusion in the posted reward tree. The contract handles the transfer of rewards and ensures the reward has not already been claimed.

- **Merkle Proof Verification**: Ensures the reward claim is valid by verifying the recipient's inclusion in the Merkle tree.

### Poster Reward Fee

The contract allows for the adjustment of the reward fee paid to the poster of a reward root. This requires multisig approval and ensures the fee remains fair and adjustable as necessary.

### Updating Signers

The list of allowed signers and the threshold required for multisig approval can be updated. This ensures flexibility in case of changes in signer availability or governance decisions.

## Usage

### 1. Posting a Reward Root
To post a reward root, an authorized individual must collect signatures from the required number of signers. The reward root, along with the total amount of tokens to be distributed, is submitted to the contract. The contract verifies the signatures and ensures the reward amount does not exceed the contract’s token balance.

### 2. Claiming a Reward
A recipient claims their reward by providing a Merkle proof that verifies their entitlement. The contract checks the validity of the proof and, if valid, transfers the tokens to the recipient. The recipient pays the wallet who posted the Merkle root in Ether when they withdraw.

### 3. Updating the Poster Reward Fee
The poster reward fee can be updated via a multisig process. Once enough signers have approved, the fee is changed, and an event is emitted.

### 4. Updating Signers
If needed, the contract's list of authorized signers can be updated. This also requires multisig approval and ensures that the contract’s governance can adapt over time.