Kwil cross-network reward distribution platform.

## The workflow of distributing Kwil Reward

```mermaid
sequenceDiagram
    Actor u as User
    participant k as Kwil
    participant s as SignerService
    participant p as PosterService
    participant g as GnosisSafe
    participant sf as Safe(EVM)
    participant r as Reward(EVM)

    rect rgba(0, 0, 255, .1)
    Note right of u: User Kwil interaction
    u ->>+ k: I want my reward
    k ->>- u: Alright, aggreate it in current period
    end

    rect rgba(0,255,0,.1)
    Note left of s: Signer service
    s ->>+ k: Fetch pending reward
    k ->>- s: Reward can be signed
    s -->> s: Sign the reward
    s ->> k: Agree reward by uploading signature
    end

    rect rgba(255,0,0,.1)
    Note right of p: Poster service
    p ->>+ k: Fetch pending rewards
    k ->>- p: Rewards can be posted to ETH
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

## Development

Since we're using GnosisSafe, and it's hard to deploy a local full stack GnosisSafe
service, we're going to use GnosisSafe on Sepolia.

First copy `.env.example` to `.env` and fill in your mnemonic. Make sure you have
enough ETH(0.1 is enough) on Sepolia.

Go https://app.safe.global/home and create a GnosisSafe Wallet on Sepolia network, with
the first three derived wallets as the owners of the GnosisSafe Wallet, those wallets
will be used in the tests/scripts.

After that, run `npm run redeploy:sepolia` to deploy RewardDistributor contract to
the Sepolia network. This will also deploy a mock erc20 token as the reward token.
Then put the contract address and Safe address to .env file.

Now you have everything except the Kwil network API. We're going to mock it in the tests.
Run `npm run test:poster:sepolia` will actually post/claim a stub Reward.
NOTE: you need to modify `kwilBlockHeight` everytime you run the test.