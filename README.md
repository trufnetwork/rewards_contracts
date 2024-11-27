# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.ts
```


## The workflow of distributing Kwil Reward

![sequence diagram](https://mermaid-js.github.io/mermaid-live-editor/edit#pako:eNqNVMtu2zAQ_JWFTikqF2mBXHQIYKTuA0WKokl7CHwIQ65owhKp8hHHCPLvXT6kRHEa1PBB2hnO7qyWe19xI7BqKod_AmqOHxWTlvVrDfRbcm8sBGAOfjm0OTgw6xVXA9MethH6tlPdU76LwQsl9Xgih4cY_mGcf0lIRvCzNk65C9biIcG1SZWwo9Xv8zeHBBvxn7hjVhRG5ljkBMobdnRcA_0_nJzU8O59UfhuPIJVcuPBtBCa5DM5AqWpUsa9MkUpwOL09C1sG_gKu5iy35N6TJjxbcQXUWTZJckamJQWGaVQnvSAB2uRDg5olSmnUIuXSo1lHtfzOjtsU5muKe0FKvZW8dIuN9X3CT3fUBYtlJYv1UgKuVXAmYYbBBf1xKRDpDEL-A3OJFKamGVJ3kYIbvYQhs6wlDGqMR8svmIxG3xucfoUQ1NmZe5xeNWjm5kcRpNudDlERQHewOryy0xQUjprCEe4vAOmqTFGt8r29JqJMnUlqRKDBqSLivR1xT4K0jPeIQ8eJ6-P0quMxAnVRi_MbroaMnNc28AZI8nrKHJpmXZ58q5Lz9vMsyMtOsnmCsOW8qLS6jYO2XXGUxfFE51EkxMrXqnz0HlFH_sw8RPXowmLbjDa4avj-58XbeU3_7xnk1feMdU_N1tu2szqWSROXqmyqq56tD1TgjbcfQyvKxrnHtdVQ48CW0bO19VaPxCVBW8u9ppXjbcB6yoMgq5uWYhV07LOTdGVULTTpiBtoCtjHkmY4PO8WtOGrStrgtwUxsNf38K7tw)

```mermaid
sequenceDiagram
    Actor u as User
    participant k as Kwil
    Actor s as Signer
    Actor p as Poster
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