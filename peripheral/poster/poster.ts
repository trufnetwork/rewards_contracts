import {ethers, parseUnits, toBigInt} from "ethers";
import pino from "pino";

import {RewardContractABI, KwilAPI, KwilFinalizedReward} from "../lib/reward";
import {RewardSafe} from "../lib/gnosis";
import {getTxRevertMessage} from "../lib/utils";
import {FinalizedReward, RewardRecord, State} from "./state";

const CONSTANTS = {
    FETCH_KWIL_REWARD_BATCH_LIMIT: 10,
    NUM_OF_CONFIRMATION: 10, // 140s with 14s block time
    NUM_OF_WAIT_TOO_LONG: 270, // roughly 1 hour
    EXTRA_TIP_IN_GWEI: 3,
} as const

function base64ToHex(s: string): string {
    return '0x' + Buffer.from(s, 'base64').toString('hex')
}

function toRewardRecord(finalizedReward: KwilFinalizedReward, decimals: bigint): FinalizedReward {
    const signaturesInHex = finalizedReward.signatures.map(
        base64ToHex
    );

    let amount = parseUnits(finalizedReward.total_rewards, decimals);

    const reward: FinalizedReward = {
        root: base64ToHex(finalizedReward.reward_root),
        amount: amount.toString(),
        signers: finalizedReward.voters,
        signatures: signaturesInHex,
        createdAt: finalizedReward.end_height, // the height when epoch reward is created
        safeNonce: finalizedReward.safe_nonce,
    };
    return reward;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// EVMPoster is the transaction poster for EVM compatible chains.
// It works by syncing all finalized rewards from Kwil network, then proposing and
// executing GnosisSafe transaction.
// If the provided state.lastBlock is set, it will sync from that block.
class EVMPoster {
    private readonly rewardContract
    private readonly rewardDecimal: bigint = 0n
    private readonly eth: ethers.Provider
    private readonly safe: RewardSafe
    private readonly kwil: KwilAPI
    private readonly state: State
    private logger: pino.Logger
    private signer: ethers.Wallet

    constructor(
      rewardSafe: RewardSafe,
      rewardAddress: string,
      signer: ethers.Wallet,
      kwil: KwilAPI,
      ethProvider: ethers.Provider,
      state: State = new State(), // default to memory state
      logger: pino.Logger,
    ) {
        this.kwil = kwil
        this.state = state
        this.signer = signer
        this.eth = ethProvider
        this.safe = rewardSafe
        this.rewardContract = new ethers.Contract(rewardAddress, RewardContractABI, this.eth)
        this.rewardDecimal = this.rewardContract.decimals;
        this.logger = logger;
    }

    // get a list of finalized rewards and handle them in batch.
    // since we're bookkeeping synced rewards, we can use this to
    async fetchPendingRewards(): Promise<void> {
        try {
            this.logger.info('Fetching pending rewards')
            const reqs = await this.kwil.ListFinalized(
            this.state.lastBlock,
            CONSTANTS.FETCH_KWIL_REWARD_BATCH_LIMIT)

            if (reqs.length === 0) {
              this.logger.info("No new rewards")
              return
            }

            let rewards = reqs.map(req => {
              return toRewardRecord(req, this.rewardDecimal);
            });

            rewards = rewards.filter(r => r.createdAt > this.state.lastBlock);

            await this.state.pendingRewardRecord(...rewards);

            // Check if rewards already posted
            for (const r of rewards) {
              this.logger.info({ root: r.root, kwilBlock: r.createdAt }, 'New finalized reward')
              const poster = await this.rewardContract.rewardPoster(r.root)

              if (poster !== ethers.ZeroAddress) {
                  this.logger.info({
                    root: r.root,
                    kwilBlock: r.createdAt
                  }, 'Reward already posted, skipping')

                  await this.state.skipResult(r.createdAt)
              }
           }
        } catch (err) {
            this.logger.error(err, 'Failed to fetch finalized rewards')
        }
    }

    // Syncs already posted rewards to local state/db from state.lastBlock.
    async fastSync() {
        // all rewards with older safeNonce are posted.
        const safeNonce = await this.safe.getNonce();
        let syncing = true;
        const batchSize = 30;

        while (syncing) {
            try {
                this.logger.info({afterBlock: this.state.lastBlock, batch: batchSize}, 'Sync rewards')

                const reqs = await this.kwil.ListFinalized(
                    this.state.lastBlock, batchSize)

                if (reqs.length === 0) { // Since API returns include current
                    syncing = false;
                    break // synced
                }

                let rewards = reqs.map(req => {
                    return toRewardRecord(req, this.rewardDecimal);
                });

                if (rewards[0].safeNonce >= safeNonce) {
                    syncing = false;
                    break // synced
                }
                rewards = rewards.filter(r => (r.createdAt > this.state.lastBlock && r.safeNonce < safeNonce) );
                await this.state.syncRewardRecord(...rewards);

                await delay(1000);
            } catch (err) {
                this.logger.error(err, 'Failed to sync finalized rewards')
                syncing = false;
                break // synced
            }
        }
    }

    async checkRewardPostingStatus() {
        if (this.state.pending.length === 0) {
            return
        }

        const block :number = this.state.pending[0];
        this.logger.info({kwilBlock: block}, 'Checking reward status')
        if (!this.state.index.has(block)) {
            this.logger.info('Reward block not found', { block })
            return
        }

        const reward = this.state.rewards[this.state.index.get(block)!];

        try {
            if (reward.result === undefined) {
                await this.postReward(reward, 0, false);
            } else {
                await this.followEVMTx(reward);
            }
        } catch (err) {
            this.logger.error(err, 'Failed to post reward')
        }
    }

    async postReward(rd: RewardRecord, extraTipInGwei: number = 0, prioritize: boolean) {
        const root = Buffer.from(rd.request.root, 'hex')

        const currentBlock = await this.eth.getBlockNumber()
        const accountNonce = await this.eth.getTransactionCount(this.signer.address)

        const proposer = rd.request.signers[0]
        const proposerSignature = rd.request.signatures[0]

        // NOTE: maybe Kwil API can also return the safeTxHash associated with Reward? seems not necessary
        // propose GnosisSafe tx
        const safeTxHash = await this.safe.proposeRewardWithSignature(rd.request.root, rd.request.amount,
            proposer, ethers.toQuantity(proposerSignature));

        this.logger.info({ root: rd.request.root, amount: rd.request.amount,
            safeTxHash: safeTxHash, safeNonce: rd.request.safeNonce, proposer: proposer},
            "Propose safe tx")

        // confirm GnosisSafe tx
        for (let i = 1; i < rd.request.signers.length; i++) {
            const signature = rd.request.signatures[i]
            await this.safe.confirmRewardWithSignature(rd.request.root, rd.request.amount, ethers.toQuantity(signature));
            this.logger.info({ root: rd.request.root, amount: rd.request.amount,
                safeTxHash: safeTxHash, safeNonce: rd.request.safeNonce, signer: rd.request.signers[i]},
                "Confirm safe tx")
        }

        const feeData = await this.eth.getFeeData();

        // execute GnosisSafe tx
        const txHash = await this.safe.executeTx(safeTxHash, this.signer.privateKey, this.signer.address,
            feeData.maxFeePerGas!.toString(),
            (feeData.maxPriorityFeePerGas! + toBigInt(extraTipInGwei)).toString(),
            prioritize ? rd.result!.accountNonce! : undefined);

        this.logger.info({ root: rd.request.root, amount: rd.request.amount,
            safeTxHash: safeTxHash, txHash: txHash, block: currentBlock},
            "Execute safe tx, post reward")

        // get posted tx info
        const tx = await this.eth.getTransaction(txHash);

        await this.state.updateResult(rd.request.createdAt, {
            hash: txHash,
            fee: (tx!.gasPrice * tx!.gasLimit).toString(),
            gasPrice: tx!.gasPrice.toString(),
            postBlock: currentBlock,
            includeBlock: 0,
            accountNonce: accountNonce,
        });
    }

    async followEVMTx(rd: RewardRecord) {
        const currentBlock = await this.eth.getBlockNumber()
        const tx = await this.eth.getTransaction(rd.result!.hash);
        if (tx!.blockNumber === null) { // pending
            if (currentBlock - rd.result!.postBlock > CONSTANTS.NUM_OF_WAIT_TOO_LONG) {
                this.logger.info( { root: rd.request.root, tx: rd.result!.hash, waited: currentBlock - rd.result!.postBlock}, 'tx has been pending for too long, prioritize it. ')
                await this.postReward(rd, CONSTANTS.EXTRA_TIP_IN_GWEI, true);
                return
            }

            this.logger.info({ root: rd.request.root, tx: rd.result!.hash, waited: currentBlock - rd.result!.postBlock }, 'Tx still pending, hash:')
            return
        }

        const txReceipt = await this.eth.getTransactionReceipt(rd.result!.hash);

        if (txReceipt!.status === 1) {
            if (currentBlock - txReceipt!.blockNumber! > CONSTANTS.NUM_OF_CONFIRMATION) {
                this.logger.info({ root: rd.request.root, tx: rd.result!.hash, block: txReceipt!.blockNumber! }, "reward Tx confirmed ")
                await this.state.updateResult(rd.request.createdAt, {
                    hash: rd.result!.hash,
                    fee: txReceipt!.fee!.toString(),
                    gasPrice: txReceipt!.gasPrice.toString(),
                    postBlock: rd.result!.postBlock,
                    includeBlock: txReceipt!.blockNumber!,
                    accountNonce: rd.result?.accountNonce!,
                })

                return
            }

            this.logger.info({ root: rd.request.root, tx: rd.result!.hash, block: txReceipt!.blockNumber! }, "reward Tx included but not confirmed yet")
            return
        }

        const revertMsg = await getTxRevertMessage(this.eth, tx!);
        // const txResp = await txReceipt?.getResult();
        this.logger.info({ tx: rd.result!.hash, waited: currentBlock - rd.result!.postBlock, err: revertMsg }, 'Tx failed',)
    }

    async runOnce() {
        await this.fetchPendingRewards(); // Should execute both together
        await this.checkRewardPostingStatus();
    }

    // this is how the poster should run.
    async _run(interval: number)
    {
        await this.fastSync();

        setInterval(async () => {
            await this.runOnce()
        }, interval) // should be long enough so that TX is posted and stated is synced to disk, before the next round of checking
    }

}

export { KwilAPI, EVMPoster }