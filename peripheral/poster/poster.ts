import {ethers, formatUnits, parseUnits, toBigInt} from "ethers";
import pino from "pino";

import {KwilAPI, KwilEpoch} from "../lib/reward";
import {RewardSafe, SafeMeta} from "../lib/gnosis";
import {getTxRevertMessage} from "../lib/utils";
import {FinalizedEpoch, EpochRecord, State, EpochVote, TxInfo} from "./state";
import dotenv from "dotenv";
dotenv.config();

const CONSTANTS = {
    FETCH_KWIL_REWARD_BATCH_LIMIT: Number(process.env.KP_FETCH_KWIL_REWARD_BATCH_LIMIT ?? 10),
    NUM_OF_CONFIRMATION: Number(process.env.KP_NUM_OF_CONFIRMATION ?? 12), // 168s with 14s block time, same as kwild
    NUM_OF_WAIT_TOO_LONG: Number(process.env.KP_NUM_OF_WAIT_TOO_LONG ?? 270), // roughly 1 hour
    GWEI_EXTRA_TIP: Number(process.env.KP_GWEI_EXTRA_TIP ?? 5),
    GWEI_MAX_FEE_PER_GAS: Number(process.env.KP_GWEI_MAX_FEE_PER_GAS ?? 100), // we do not want to accidentally spend all of our money
} as const

function base64ToBytes32(s: string): string {
    return '0x' + Buffer.from(s, 'base64').toString('hex')
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// EVMPoster is the transaction poster for EVM compatible chains.
// It works by syncing all finalized rewards from Kwil network, then proposing and
// executing GnosisSafe transaction.
// If the provided state.lastBlock is set, it will sync from that block.
class EVMPoster {
    private readonly rewardContract: ethers.Contract
    private readonly eth: ethers.Provider
    private readonly safe: RewardSafe
    private readonly kwil: KwilAPI
    private readonly state: State
    private logger: pino.Logger
    private signer: ethers.Wallet

    constructor(
      rewardSafe: RewardSafe,
      rewardContract: ethers.Contract,
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
        this.rewardContract = rewardContract
        this.logger = logger;
    }

    // get a list of finalized rewards and handle them in batch.
    // we CANNOT use `LatestFinalized` as it will skip some rewards.
    async fetchActiveFinalizedEpoch(safeMeta: SafeMeta): Promise<FinalizedEpoch | null> {
        this.logger.debug('Fetching active epoch')
        const reqs: KwilEpoch[] = await this.kwil.GetActiveEpochs()

        if (reqs.length === 0) {
            throw new Error('no active epochs')
        }

        if (reqs.length == 1) {
            // Two reasons there is only one active epoches
            // 1. the very first epoch is just created
            // 2. the previous epoch is confirmed, but currently there are no rewards/issuances in the current epoch
            // In either case, we wait until there are 2 active epoches; and the 1st one(finalized) is ready to be voted.
            return null;
        }

        if (reqs.length != 2) {
            throw new Error('unexpected number of active epochs')
        }

        // the first one has finalized
        const reqEpoch = reqs[0];

        if (reqEpoch.voters === null) {
            return null
        }

        const epoch: FinalizedEpoch = {
            root: base64ToBytes32(reqEpoch.reward_root),
            total: reqEpoch.reward_amount,
            block: reqEpoch.end_height, // the height when epoch reward is created
            votes: reqEpoch.voters.map((v, idx): EpochVote=> {
                if (reqEpoch.voters !== null) {
                    return {
                        voter: reqEpoch.voters[idx],
                        nonce: reqEpoch.vote_nonces[idx],
                        signature: reqEpoch.voter_signatures[idx]
                    } as EpochVote;
                }

                return {} as EpochVote;
            }),
        };

        epoch.votes = epoch.votes.filter(v => v.nonce.toString() === safeMeta.nonce.toString());

        if (epoch.votes.length < safeMeta.threshold) {
            return null;
        }

        // TODO: also we can verify the signature, to filter out invalid signature

        return epoch;
    }

    async postEpoch(epoch: FinalizedEpoch, safeMeta: SafeMeta, prioritizeTipInWei: number = 0, prioritizeNonce: number, prioritize: boolean) {
        let root: string = epoch.root;
        let amount: string = epoch.total;
        // amount and nonce match
        const eligibleVotes = epoch.votes.filter(
            v => v.nonce.toString() === safeMeta.nonce.toString())

        // TODO: check if the contract has enough token, i.e. `token.balanceOf(epoch.ContractAddress) >= epoch.request.amount`
        // TODO: maybe only use least required signatures, to safe gas.

        const nonce = prioritize ? prioritizeNonce : safeMeta.nonce;

        const {safeTx, safeTxHash} = await this.safe.createTx(root, amount,
            eligibleVotes.map(v => v.voter),
            eligibleVotes.map(v => base64ToBytes32(v.signature)),
            // nonce
        );

        const feeData = await this.eth.getFeeData(); // https://docs.alchemy.com/docs/maxpriorityfeepergas-vs-maxfeepergas
        // we will not operate on network pre EIP-1559, so maxFeePerGas/maxPriorityFeePerGas is not null
        const gweiMaxFeePerGas = Number(formatUnits(feeData.maxFeePerGas!, 'gwei'))
        if (gweiMaxFeePerGas > CONSTANTS.GWEI_MAX_FEE_PER_GAS) {
            throw new Error(`Max fee per gas is too high: ${gweiMaxFeePerGas} > ${CONSTANTS.GWEI_MAX_FEE_PER_GAS}(configured) Gwei.`)
        }

        // execute GnosisSafe tx
        const currentBlock = await this.eth.getBlockNumber()
        const accountNonce = await this.eth.getTransactionCount(this.signer.address)

        const txHash = await this.safe.executeTx(safeTx, this.signer.privateKey, this.signer.address,
            feeData.maxFeePerGas!.toString(),
            (feeData.maxPriorityFeePerGas! + toBigInt(prioritizeTipInWei)).toString(),
            // nonce
        );

        this.logger.info({ root: root, amount: amount,
            safeTxHash: safeTxHash, txHash: txHash, block: currentBlock,},
            "Execute safe tx, post epoch")

        // get posted tx info
        const tx = await this.eth.getTransaction(txHash);

        await this.state.newRecord({
            epoch: epoch,
            result: {
                        hash: txHash,
                        // fee: "", not available yet
                        // gasPrice: "", not available yet
                        postBlock: currentBlock,
                        includeBlock: 0,
                        accountNonce: accountNonce,
                        safeNonce: nonce
                    } as TxInfo })
    }

    async runOnce() {
        const safeMeta = await this.safe.getMetadata()

        // we always use the latest epoch from Kwil, since there might be more vote
        const newEpoch = await this.fetchActiveFinalizedEpoch(safeMeta);
        if (newEpoch === null) {
            this.logger.info(`No finalized epoch. Safe nonce: ${safeMeta.nonce}, threshold: ${safeMeta.threshold}`, )
            return
        }

        // we get one epoch with enough votes, and the epoch could be in those state:
        // - totally new to posterSvc;
        // - posterSvc has posted this epoch; If posterSvc see this, we know it's not confirmed on Kwil; then we either wait or re-submit with higher gas tip

        // if no state, then this is the first epoch posterSvc ever seen
        if (this.state.records.length === 0) {
            this.logger.info({ root: newEpoch.root, nonce: safeMeta.nonce },'First epoch, posting it')
            await this.postEpoch(newEpoch, safeMeta, 0, 0, false);
            return
        }

        const lastRecord = this.state.records[this.state.records.length - 1];

        if (lastRecord  && lastRecord.epoch.root !== newEpoch.root) {
            this.logger.info({ root: newEpoch.root, nonce: safeMeta.nonce }, 'New epoch, post it')
            // new epoch for posterSvc; so we know last epoch is confirmed
            // We use Kwil's state not posterSvc's state to determine whether an epoch is confirmed.
            await this.postEpoch(newEpoch , safeMeta, 0, 0, false);
        } else {
            if (lastRecord.result!.includeBlock !== 0) {
                // this should only happens, if kwil has issues not syncing correctly;
                this.logger.warn({ root: newEpoch.root, nonce: safeMeta.nonce }, 'Posted epoch has been included on evm chain, but not confirmed on kwil network')
                return
            }

            this.logger.info({ root: newEpoch.root, nonce: safeMeta.nonce }, 'Posted epoch, checking status')

            // NOTE: what if Safe is updated(nonce changed) after posterSvc submit the tx?
            // If that's the case, the tx will fail eventually. Although we waste some gas, but this is simpler mental model.
            // So we just wait the tx to fail, and re-submit with newer safe nonce.

            const currentBlock = await this.eth.getBlockNumber()
            const tx = await this.eth.getTransaction(lastRecord.result!.hash);
            // If tx is still pending, i.e. in EVM mempool
            if (tx!.blockNumber === null) {
                if (currentBlock - lastRecord.result!.postBlock > CONSTANTS.NUM_OF_WAIT_TOO_LONG) {
                    this.logger.info( { root: lastRecord.epoch.root, tx: lastRecord.result!.hash, waited: currentBlock - lastRecord.result!.postBlock}, 'tx has been pending for too long, prioritize it. ')
                    const lastRecordTxNonce = lastRecord.result!.accountNonce!;
                    await this.postEpoch(lastRecord.epoch, safeMeta, CONSTANTS.GWEI_EXTRA_TIP, lastRecord.result!.accountNonce, true);
                    return
                }

                this.logger.info({ root: lastRecord.epoch.root, tx: lastRecord.result!.hash, waited: currentBlock - lastRecord.result!.postBlock }, 'Tx still pending, hash:')
                return
            }

            // If tx is included in a block
            const txReceipt = await this.eth.getTransactionReceipt(lastRecord.result!.hash);

            // If tx succeeds
            if (txReceipt!.status === 1) {
                if (currentBlock - txReceipt!.blockNumber! > CONSTANTS.NUM_OF_CONFIRMATION) {
                    this.logger.info({ root: lastRecord.epoch.root, tx: lastRecord.result!.hash, block: txReceipt!.blockNumber! }, "rewalastRecord Tx confirmed ")
                    await this.state.updateResult(lastRecord.epoch.root, {
                        hash: lastRecord.result!.hash,
                        fee: txReceipt!.fee!.toString(),
                        gasPrice: txReceipt!.gasPrice.toString(),
                        postBlock: lastRecord.result!.postBlock,
                        includeBlock: txReceipt!.blockNumber!,
                        accountNonce: lastRecord.result?.accountNonce!,
                        safeNonce: lastRecord.result?.safeNonce!,
                    })

                    return
                }

                this.logger.info({ root: lastRecord.epoch.root, tx: lastRecord.result!.hash, block: txReceipt!.blockNumber! }, "rewalastRecord Tx included but not confirmed yet")
                return
            }

            // Then tx fail
            const revertMsg = await getTxRevertMessage(this.eth, tx!);
            // const txResp = await txReceipt?.getResult();
            this.logger.info({ tx: lastRecord.result!.hash, waited: currentBlock - lastRecord.result!.postBlock, err: revertMsg }, 'Tx failed',)
            // most likely due to the safe nonce issue. we re-post it with new safe metadata
            await this.postEpoch(newEpoch , safeMeta, 0, 0,false);
        }
    }

    // this just shows how the poster should run. Don't run this
    async _run(interval: number)
    {
        setInterval(async () => {
            await this.runOnce()
        }, interval) // should be long enough so that TX is posted and stated is synced to disk, before the next round of checking
    }

}

export { KwilAPI, EVMPoster, base64ToBytes32}