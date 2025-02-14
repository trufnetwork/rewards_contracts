# Kwil Reward Distribution

## Work flows
```mermaid
sequenceDiagram
    Actor u as User
    participant k as Kwil
    participant s as SignerService
    participant p as PosterService
    participant g as Safe(OffChain)
    participant sf as Safe(EVM)
    participant r as Reward(EVM)

    rect rgba(0, 255, 255, .1)
    Note right of u: User interaction
    u ->>+ k: Call/Execute an Action
    k -->> k: Trigger issuing reward to User
    k -->> k: Pending in current epoch
    end

    k -->> k: Propose an epoch reward: <br> Aggregate rewards in current epoch. <br> Generate merkle tree from all rewards.

    rect rgba(0,255,0,.1)
    Note left of s: Signer service
    s ->>+ k: Request pending epoch rewards
    k ->>- s: Return rewards that can be voted/signed
    s -->> s: Sign the reward
    s ->> k: Agree/vote reward by uploading signature
    end

    rect rgba(255,0,0,.1)
    Note right of p: Poster service
    p ->>+ k: Fetch signed rewards not yet posted to Ethereum
    k ->>- p: Return unposted rewards(with enough votes) <br>to be posted to Ethereum
    p ->>+ g: Propose Tx and confirm Tx
    g -->>- p: Tx will be ready to be executed

    p ->>+ g: Execute as non-owner
    g ->>+ sf: Call `execTransaction`
    sf ->>+ r: Call `postReward`
    r -->>- sf: Event `RewardPosted`
    sf -->>- g: Event `SafeMultiSigTransaction`
    g -->>- p: Execute response
    end

    rect rgba(0,0, 255, .1)
    Note right of u: User Eth interaction
    u ->>+ r: Call `claimReward`
    r ->>- u: Event `RewardClaimed`
    end
```



## Technical Overview

### Different roles involved

- Kwil: Kwil blockchain. Learn more about Kwil [here](https://docs.kwil.com).
- SignerService: Kwil network reward signer service. It manages individual signatures for the SAFE wallet and uploads signatures to a Kwil database (to be used be `PosterService`).
- PosterService: A service that uses transactions from `SignerService` to propose/confirm/execute transactions through Safe to this contract.
- Safe: Safe wallet that has admin privileges to update a contract's state, through `postReward`/`updatePosterFee`.
- Reward: Kwil Reward escrow contract.
- User: A wallet which is able to claim reward through `claimReward`, providing proofs.

### Contracts

There are two contracts in this repo:
- [RewardDistributor](../contracts/RewardDistributor.sol) contract: which is a [minimal proxy contract](https://eips.ethereum.org/EIPS/eip-1167).  Read more at [here](./RewardDistributor.md)
- Factory contract, which creates both [Safe Wallet](https://safe.global/wallet) and [RewardDistributor](../contracts/RewardDistributor.sol).
