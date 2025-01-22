import hre from "hardhat";
import {getTxRevertMessage} from "../peripheral/lib/utils";

async function main() {
    if (hre.network.name != "sepolia") {
        console.log("Skip test on network: " + hre.network.name);
        return;
    }

    const txHash = "0x52b1a2631bd0c3f13325a03a40180adcc9d9f497bafff21cf811bf78da6aa186";

    const rpcURL = process.env.SEPOLIA_RPC!;
    const provider = new hre.ethers.JsonRpcProvider(rpcURL);
    const tx = await provider.getTransaction(txHash);
    const revertMsg = await getTxRevertMessage(provider, tx!);
    console.log("revert message: ", revertMsg);
}

main().catch(console.error)