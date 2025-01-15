import hre from "hardhat";
import {GenHDWallets} from "../peripheral/lib/wallet";
import {HardhatNetworkHDAccountsConfig} from "hardhat/src/types/config";

async function main() {
    let actConfig: HardhatNetworkHDAccountsConfig = hre.network.config.accounts as HardhatNetworkHDAccountsConfig;
    console.log("current block: ", await hre.ethers.provider.getBlockNumber())

    const [ceo, cfo, eng, poster] = GenHDWallets(actConfig.mnemonic);
    console.log("==========____", ceo.privateKey, ceo.address);
}

main().catch(console.error)