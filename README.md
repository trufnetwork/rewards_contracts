Kwil cross-network reward distribution platform.

## The workflow of distributing Kwil Reward

```mermaid
sequenceDiagram
    Actor u as User
    participant k as Kwil
    participant s as SignerService
    participant p as PosterService
    participant g as Safe
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

## Development with Sepolia testnet

Since we're using Safe, and it's hard to deploy a local full stack Safe
service, we're going to use Safe on Sepolia.

First copy `.env.example` to `.env` and fill in your mnemonic. Make sure you have
enough ETH(0.1 is enough) on Sepolia.

Go https://app.safe.global/home and create a Safe Wallet on Sepolia network, with
the first three derived wallets(from the mnemonic) as the owners of the Safe Wallet,
those wallets will be used in the tests/scripts.

After that, run `npm run redeploy:sepolia` to deploy RewardDistributor contract to
the Sepolia network. This will also deploy a mock erc20 token as the reward token.
Then put the contract address and Safe address to .env file.
