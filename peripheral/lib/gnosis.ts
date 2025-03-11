import Safe, {EthSafeSignature} from '@safe-global/protocol-kit';
import {SafeTransaction, MetaTransactionData, OperationType} from '@safe-global/types-kit';

import {genPostRewardTxData, genUpdatePosterFeeTxData} from "./reward";
import {RequestArguments} from "@safe-global/protocol-kit/dist/src/types/safeProvider";

type Eip1193Provider = {
    request: (args: RequestArguments) => Promise<unknown>;
};

type BigNumberish = string | number | bigint;

interface SafeMeta {
    nonce: number;
    threshold: number;
    owners: string[];
}

/**
 * RewardSafe is a wrapper on Safe core SDK to call RewardDistributor contract.
 * We intentionally avoid using @safe-global/api-kit, so we don't rely on the centralized Safe Transaction Service.
 */
class RewardSafe {
    rpc: Eip1193Provider | string;
    safeAddress: string;
    rewardAddress: string;


    constructor(rpc: Eip1193Provider | string, chainID: bigint,rewardAddress: string, safeAddress: string) {
        this.rpc = rpc;
        this.safeAddress = safeAddress;
        this.rewardAddress = rewardAddress;
    }

    // generate a GnosisSafe transaction hash to call `postReward` function on RewardContract
    async genPostRewardSafeTx(root: string, amount: BigNumberish, nonce?: number) {
        const safe = await Safe.init({
            provider: this.rpc,
            safeAddress: this.safeAddress,
        })

        const txData: MetaTransactionData = {
            to: this.rewardAddress,
            value: '0',
            data: genPostRewardTxData(root, amount),
            operation: OperationType.Call
        }

        const transactions = [txData];

        const safeTx = await safe.createTransaction({
            transactions: transactions,
            options: {
                // safeTxGas?: string;
                // baseGas?: string;
                // gasPrice?: string;
                // gasToken?: string;
                // refundReceiver?: string;
                nonce: nonce,
            },
        })

        const safeTxHash = await safe.getTransactionHash(safeTx);
        return {safeTx, transactions, safeTxHash}
    }

    // generate a GnosisSafe transaction hash to call `updatePosterFee` function on RewardContract
    async genUpdatePosterFeeSafeTx(fee: BigNumberish) {
        const safe = await Safe.init({
            provider: this.rpc,
            safeAddress: this.safeAddress,
        })

        const txData: MetaTransactionData = {
            to: this.rewardAddress,
            value: '0',
            data: genUpdatePosterFeeTxData(fee),
            operation: OperationType.Call
        }

        const safeTx = await safe.createTransaction({
            transactions: [txData]
        })

        const safeTxHash = await safe.getTransactionHash(safeTx);
        return {safeTx, safeTxHash}
    }

    // generate the signature for a new transaction to upload Reward.
    // As long as we have signature, we can propose/confirm a transaction from non-signer wallet.
    async signPostReward(root: string, amount: BigNumberish, signerPK: string, nonce?: number) : Promise<{safeTxHash: string, signature: string}> {
        const safeSigner = await Safe.init({
            provider: this.rpc,
            safeAddress: this.safeAddress,
            signer: signerPK
        })

        const {safeTxHash} = await this.genPostRewardSafeTx(root, amount, nonce);
        const safeSignature = await safeSigner.signHash(safeTxHash)
        return {safeTxHash, signature: safeSignature.data}
    }

    async signUpdatePosterFee(fee: BigNumberish, signerPK: string) : Promise<{safeTxHash: string, signature: string}> {
        const safeSigner = await Safe.init({
            provider: this.rpc,
            safeAddress: this.safeAddress,
            signer: signerPK
        })

        const {safeTxHash} = await this.genUpdatePosterFeeSafeTx(fee);
        const safeSignature = await safeSigner.signHash(safeTxHash)
        return {safeTxHash, signature: safeSignature.data}
    }

    async getNonce() {
        const safe = await Safe.init({
            provider: this.rpc,
            safeAddress: this.safeAddress,
        })

        return await safe.getNonce();
    }

    async getMetadata() : Promise<SafeMeta> {
        const safe = await Safe.init({
            provider: this.rpc,
            safeAddress: this.safeAddress,
        })

        // TODO: maybe use multicall3
        return {nonce: await safe.getNonce(),
                threshold: await safe.getThreshold(),
                owners: await safe.getOwners()} as SafeMeta;
    }


    async createTx(root: string, amount: BigNumberish,
                   signers: string[], signatures: string[], nonce?: number,) {
        const safe = await Safe.init({
            provider: this.rpc,
            safeAddress: this.safeAddress,
        })

        const {safeTx, transactions, safeTxHash} = await this.genPostRewardSafeTx(root, amount, nonce);

        // REF: https://docs.safe.global/sdk-protocol-kit/guides/signatures/transactions
        signers.forEach((signer, i) => {

            // NOTE: `false` when EthSafeSignature, means this is the signature from EOA, i.e., ECDSA signature
            // THE V or the last two hex in the signature should be 1f(31) or 20(32), because we use EIP-191
            safeTx.addSignature(new EthSafeSignature(signer, signatures[i], false))
        })

        return {safeTx: safeTx, transactions, safeTxHash}
    }

    // execute a GnosisSafe transaction (assume the threshold has reached).
    // Since safeTxHash represents an off-chain transaction, the signer can be any
    // wallet, as long as it pays the tx fee.
    async executeTx(tx: SafeTransaction, signerPK: string, signerAddress: string,
                    maxFeePerGas:string, maxPriorityFeePerGas:string, nonce?: number) : Promise<string>     {
        const safe = await Safe.init({
            provider: this.rpc,
            signer: signerPK,
            safeAddress: this.safeAddress
        })

        // NOTE: if get 'execution reverted', mostly likely because signer doesn't have enough ETH balance to pay gas.
        const transactionResponse = await safe.executeTransaction(tx,
            {
                maxFeePerGas: maxFeePerGas,
                maxPriorityFeePerGas: maxPriorityFeePerGas,
                from: signerAddress,
                nonce: nonce,
            });

        return transactionResponse.hash
    }

}

export { RewardSafe , SafeMeta}