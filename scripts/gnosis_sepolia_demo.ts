import hre from "hardhat";

import SafeApiKit from '@safe-global/api-kit';
import Safe from '@safe-global/protocol-kit';
import {
    MetaTransactionData,
    OperationType
} from '@safe-global/types-kit';

import {genPostRewardTxData} from "../peripheral/lib/reward";
import {RewardSafe} from "../peripheral/lib/gnosis";
import {GenHDWallets} from "../peripheral/lib/wallet";

import dotenv from 'dotenv';
dotenv.config();


// refer: https://docs.safe.global/core-api/transaction-service-guides/transactions
async function offChainTX(config: any) {
    // Initialize the API Kit
    const apiKit = new SafeApiKit({
        chainId: config.CHAIN_ID,
    })

    // Initialize the Protocol Kit with Owner A
    const protocolKitOwnerA = await Safe.init({
        provider: config.RPC_URL,
        signer: config.TX_PROPOSER_PRIVATE_KEY,
        safeAddress: config.SAFE_ADDRESS
    })

    // Create a Safe transaction
    const safeTransactionData: MetaTransactionData = {
        to: config.REWARD_ADDRESS,
        value: config.VALUE,
        data: config.DATA,
        operation: OperationType.Call
    }

    const safeTransaction = await protocolKitOwnerA.createTransaction({
        transactions: [safeTransactionData]
    })

    // Sign the transaction with Owner A
    const safeTxHash = await protocolKitOwnerA.getTransactionHash(safeTransaction)
    const signatureOwnerA = await protocolKitOwnerA.signHash(safeTxHash)


    //// sendTx
    // Send the transaction to the Transaction Service with the signature from Owner A
    await apiKit.proposeTransaction({
        safeAddress: config.SAFE_ADDRESS,
        safeTransactionData: safeTransaction.data,
        safeTxHash,
        senderAddress: config.TX_PROPOSER_ADDRESS,
        senderSignature: signatureOwnerA.data
    })

    //// collect/sign tx
    // Initialize the Protocol Kit with Owner B
    const protocolKitOwnerB = await Safe.init({
        provider: config.RPC_URL,
        signer: config.TX_CONFIRMER_PRIVATE_KEY,
        safeAddress: config.SAFE_ADDRESS
    })

    // Sign the transaction with Owner B
    const signatureOwnerB = await protocolKitOwnerB.signHash(safeTxHash)

    // Send the transaction to the Transaction Service with the signature from Owner B
    await apiKit.confirmTransaction(
        safeTxHash,
        signatureOwnerB.data
    )

    //// execute tx
    const protocolKitPoster = await Safe.init({
        provider: config.RPC_URL,
        signer: config.TX_POSTER_PRIVATE_KEY,
        safeAddress: config.SAFE_ADDRESS
    })
    const signedTransaction = await apiKit.getTransaction(safeTxHash)
    const transactionResponse =
        await protocolKitPoster.executeTransaction(signedTransaction)

    //// query executed tx
    const transactions = await apiKit.getMultisigTransactions(config.SAFE_ADDRESS)
    if (transactions.results.length > 0) {
        console.log('Last executed transaction', transactions.results[0])
    }
}

// NOTE: this example of using gnosis safe SDK to interact with GnosisSafe
async function gnosisSDK(root: string, amount: number, mnemonic: string, rpcURL:string) {
    // NOTE: This root has been uploaded
    // const root = "0x2b99d11a9a089537b17930650ae00cadce38788df0b095c1e9f350d7088d24bb";
    // const amount = 100

    const data = genPostRewardTxData(root, amount);
    const [ceo, cfo, eng, poster] = GenHDWallets(mnemonic);

    const config = {
        RPC_URL: rpcURL,
        CHAIN_ID: 11155111n, // Sepolia
        TX_PROPOSER_PRIVATE_KEY: ceo.privateKey, // proposer
        TX_PROPOSER_ADDRESS: ceo.address,
        TX_CONFIRMER_PRIVATE_KEY: cfo.privateKey, // confirmer
        TX_CONFIRMER_ADDRESS: cfo.address,
        TX_POSTER_PRIVATE_KEY: poster.privateKey,
        TX_POSTER_ADDRESS: poster.address,
        SAFE_ADDRESS: process.env.SEPOLIA_SAFE_ADDRESS ?? '',
        REWARD_ADDRESS: process.env.SEPOLIA_REWARD_ADDRESS ?? '',
        VALUE: "0",
        DATA: data,
    };
    const tx = await offChainTX(config);
}

// this is a demo of using our RewardSafe library to interact with GnosisSafe
async function libGnosis(root: string, amount: number, mnemonic: string, rpcURL:string,
                         chainID: bigint = 11155111n, safeTxServiceUrl?: string) {
    const data = genPostRewardTxData(root, amount);
    const [ceo, cfo, eng, poster] = GenHDWallets(mnemonic);

    const config = {
        RPC_URL: rpcURL,
        CHAIN_ID: chainID,
        // CHAIN_ID: 31337, // hardhat
        TX_PROPOSER_PRIVATE_KEY: ceo.privateKey, // proposer
        TX_PROPOSER_ADDRESS: ceo.address,
        TX_CONFIRMER_PRIVATE_KEY: cfo.privateKey, // confirmer
        TX_CONFIRMER_ADDRESS: cfo.address,
        TX_POSTER_PRIVATE_KEY: poster.privateKey,
        TX_POSTER_ADDRESS: poster.address,
        SAFE_ADDRESS: process.env.SEPOLIA_SAFE_ADDRESS ?? '',
        REWARD_ADDRESS: process.env.SEPOLIA_REWARD_ADDRESS ?? '',
        DATA: data,
    };

    const gSafe = new RewardSafe(config.RPC_URL, config.CHAIN_ID, config.SAFE_ADDRESS, config.REWARD_ADDRESS, safeTxServiceUrl);
    try {
        // Proposer proposes a `postReward` tx
        // Proposer signs the tx
        const {safeTxHash, signature:proposerSig} = await gSafe.signPostReward(root, amount, config.TX_PROPOSER_PRIVATE_KEY);
        // Poster posts the Request
        await gSafe.proposeRewardWithSignature(root, amount, config.TX_PROPOSER_ADDRESS, proposerSig)
        console.log("Propose safe tx hash: ", safeTxHash);

        // Confirmer confirms a `postReward` tx
        // or
        // Confirmer confirms the tx
        const {signature:confirmerSig} =await gSafe.signPostReward(root, amount, config.TX_CONFIRMER_PRIVATE_KEY);
        // Poster posts the Request
        await gSafe.confirmRewardWithSignature(root, amount, confirmerSig);
        console.log("Confirm safe tx hash: ", safeTxHash);

        // Poster posts the off-chain transaction.
        const txHash = await gSafe.executeTx(safeTxHash, config.TX_POSTER_PRIVATE_KEY, config.TX_POSTER_ADDRESS, "", "");
        console.log(`Execute safe tx hash: ${safeTxHash}, got tx hash: ${txHash}`);

        await gSafe.queryTx(safeTxHash);
        console.log("Query   safe tx hash: ", safeTxHash);




        // try execute again
        const txHash2 = await gSafe.executeTx(safeTxHash, config.TX_POSTER_PRIVATE_KEY, config.TX_POSTER_ADDRESS, "", "");
        console.log(`re-Execute safe tx hash: ${safeTxHash}, got tx hash: ${txHash2}`);

        await gSafe.queryTx(safeTxHash);
        console.log("Query   safe tx hash: ", safeTxHash);
    } catch (err) {
        console.log("Error: ", err);
    }
}

async function main() {
    if ((hre.network.name != "sepolia") && (hre.network.name != "localhost")) {
        console.log("Skip test on network: " + hre.network.name);
        return;
    }

    let mnemonic = "test test test test test test test test test test test junk" // default hardhat mnemonic
    let rpcURL = "http://localhost:8545"
    let chainID = 31337n;

    if (hre.network.name == "sepolia") {
        mnemonic = process.env.SEPOLIA_MNEMONIC ?? '';
        rpcURL = process.env.SEPOLIA_RPC!;
        chainID = 11155111n;
    }

    // change root so create a unique Reward root
    const root = "0x1000000000000000000000000000000000000000000000000000000000000009";
    const amount = 10;
    // await oneoffScript(mnemonic, rpcURL);
    await libGnosis(root, amount, mnemonic, rpcURL, chainID);
}

main().catch(console.error)