import hre from "hardhat";
import {GenHDWallets} from "../peripheral/lib/wallet";
import {HardhatNetworkHDAccountsConfig, HardhatNetworkConfig} from "hardhat/src/types/config";
import {RewardSafe} from "../peripheral/lib/gnosis";
import {toBigInt} from "ethers";
import {getTxRevertMessage} from "../peripheral/lib/utils";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// This script will deploy a Safe transaction on the forked network.
async function main() {
    if  ((hre.network.name != "hardhat") && (hre.network.config.chainId != 31337)){
        console.log("Only work on forking network. Skip on network: " + hre.network.name);
        return;
    }

    let actConfig: HardhatNetworkHDAccountsConfig = hre.network.config.accounts as HardhatNetworkHDAccountsConfig;
    console.log("current block: ", await hre.ethers.provider.getBlockNumber())

    const [ceo, cfo, eng, poster] = GenHDWallets(actConfig.mnemonic);
    console.log("==========____", (await hre.ethers.getSigners())[3]);
    const posterSigner = (await hre.ethers.getSigners())[4];

    const gSafe = new RewardSafe(hre.network.provider,
        toBigInt(hre.network.config.chainId!), "0xbBeaaA74777B1dc14935f5b7E96Bb0ed6DBbD596", "0xeF74822F15B3dBE9267199800C495AFb5Dee86b9");

    // try execute again
    const safeTxHash = "0xdc61204b1171c2774bfa1d954d7158e17033e66d9cbdd7aa78b7a533eb1651fd"
    const txHash = await gSafe.executeTx(safeTxHash, poster.privateKey, poster.address, "", "");
    console.log(`re-Execute safe tx hash: ${safeTxHash}, got tx hash: ${txHash}`);

    const tx = await hre.ethers.provider.getTransaction(txHash);
    if (tx!.blockNumber === null) { // pending
        console.log("pending")
        return
    }

    const txReceipt = await hre.ethers.provider.getTransactionReceipt(txHash);

    if (txReceipt!.status === 1) {
        console.log("included")
    } else {
        console.log("failed")
        const revertMsg = await getTxRevertMessage(hre.ethers.provider, tx!);
        console.log("revert message: ", revertMsg);
    }
}

main().catch(console.error)