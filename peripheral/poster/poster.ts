import {KwilReward, Reward, State} from "./state";
import {ethers, toBigInt} from "ethers";
import {RewardContractABI, } from "../lib/reward";
import {RewardSafe} from "../lib/gnosis";
import {getTxRevertMessage} from "../lib/utils";
import pino from "pino";

const CONSTANTS = {
    FETCH_KWIL_REWARD_BATCH_LIMIT: 10,
    NUM_OF_CONFIRMATION: 10, // 140s with 14s block time
    NUM_OF_WAIT_TOO_LONG: 270, // roughly 1 hour
    EXTRA_TIP_IN_GWEI: 3,
} as const

/**
 * KwilAPI defines the reward distribution system API used by Poster service.
 */
declare class KwilAPI {
    // returns `limit` number of rewards since `afterBlockHeight`
    fetchRewardRequests(afterBlockHeight: number, limit: number): Promise<KwilReward[]>
}


class EVMPoster {
    private readonly rewardContract
    private readonly eth: ethers.Provider
    private readonly safe: RewardSafe
    private readonly kwil: KwilAPI
    private readonly state: State
    private logger: pino.Logger
    private posterPrivateKey: string
    private posterAddress: string

    constructor(
        rewardSafe: RewardSafe,
        rewardAddress: string,
      posterPrivateKey: string,
      posterAddress: string,
      kwil: KwilAPI,
      ethProvider: ethers.Provider,
      state: State = new State(), // default to memory state
      logfile: string = '/tmp/poster.log',
    ) {
        this.posterPrivateKey = posterPrivateKey;
        this.posterAddress = posterAddress;
        this.kwil = kwil
        this.state = state
        this.eth = ethProvider
        this.safe = rewardSafe
        this.rewardContract = new ethers.Contract(rewardAddress, RewardContractABI, this.eth)

        this.logger = pino(
            {
                level: "info",
                formatters: {
                    level: (label) => {
                        return { level: label.toUpperCase() };
                    },
                },
                timestamp: pino.stdTimeFunctions.isoTime,
            },
            pino.transport({
                targets: [
                    // {
                    //     target: 'pino/file',
                    //     options: { destination: logfile },
                    // },
                    // doesn't work if also want to write to stdout, idk why
                    {
                        target: 'pino/file', // logs to the standard output by default
                    },
                ],
            })
        );
    }

    async fetchPendingRewards(): Promise<void> {
        try {
            this.logger.info('Fetching pending rewards')

          const reqs = await this.kwil.fetchRewardRequests(
            this.state.lastBlock,
            CONSTANTS.FETCH_KWIL_REWARD_BATCH_LIMIT
          )

          if (reqs.length === 0) {
              this.logger.info("No new rewards")
            return
          }

          await this.state.addRewardRecord(...reqs);

          // Check if rewards already posted
          // NOTE: we assume rewards returned is in block height ASC order
          for (const req of reqs) {
            this.logger.info({ root: req.root, kwilBlock: req.blockHeight }, 'New reward')
            const poster = await this.rewardContract.rewardPoster(req.root)

            if (poster !== ethers.ZeroAddress) {
              this.logger.info({
                root: req.root,
                kwilBlock: req.blockHeight
              }, 'Reward already posted, skipping')

              await this.state.skipResult(req.blockHeight)
            }
          }

        } catch (err) {
          this.logger.error({ error: err }, 'Failed to fetch pending rewards')
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
                await this.followTx(reward);
            }
        } catch (err) {
            this.logger.error({ error: err }, 'Failed to posting reward')
        }
    }

    async postReward(rd: Reward, extraTipInGwei: number = 0, prioritize: boolean) {
        const root = Buffer.from(rd.request.root, 'hex')

        const currentBlock = await this.eth.getBlockNumber()
        const accountNonce = await this.eth.getTransactionCount(this.posterAddress)

        const proposer = rd.request.signers[0]
        const proposerSignature = rd.request.signatures[0]

        // NOTE: maybe Kwil API can also return the safeTxHash associated with Reward? seems not necessary
        const safeTxHash = await this.safe.proposeRewardWithSignature(rd.request.root, rd.request.amount,
            proposer, ethers.toQuantity(proposerSignature));

        this.logger.info({ root: rd.request.root, amount: rd.request.amount, safeTxHash: safeTxHash, signer: proposer}, "Propose safe tx")

        for (let i = 1; i < rd.request.signers.length; i++) {
            const signature = rd.request.signatures[i]
            await this.safe.confirmRewardWithSignature(rd.request.root, rd.request.amount, ethers.toQuantity(signature));
            this.logger.info({ root: rd.request.root, amount: rd.request.amount, safeTxHash: safeTxHash, signer: rd.request.signers[i]}, "Confirm safe tx", )
        }

        const feeData = await this.eth.getFeeData();

        const txHash = await this.safe.executeTx(safeTxHash, this.posterPrivateKey, this.posterAddress,
            feeData.maxFeePerGas!.toString(),
            (feeData.maxPriorityFeePerGas! + toBigInt(extraTipInGwei)).toString(),
            prioritize ? rd.result!.accountNonce! : undefined);

        this.logger.info({ root: rd.request.root, amount: rd.request.amount, safeTxHash: safeTxHash, txHash: txHash, block: currentBlock}, "Execute safe tx, post reward")

        const tx = await this.eth.getTransaction(txHash);

        await this.state.updateResult(rd.request.blockHeight, {
            hash: txHash,
            fee: (tx!.gasPrice * tx!.gasLimit).toString(),
            gasPrice: tx!.gasPrice.toString(),
            postBlock: currentBlock,
            includeBlock: 0,
            accountNonce: accountNonce,
        });
    }

    async followTx(rd: Reward) {
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
                await this.state.updateResult(rd.request.blockHeight, {
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

    async _run() {
        setInterval(async () => {
            await this.fetchPendingRewards(); // Should execute both together
            await this.checkRewardPostingStatus();
        }, 60000) // should be long enough so that TX is posted and stated is synced to disk, before the next round of checking
    }

}

export { KwilAPI, EVMPoster }