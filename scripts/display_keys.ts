import hre from "hardhat";
import {GenHDWallets} from "../peripheral/lib/wallet";
import {HardhatNetworkHDAccountsConfig} from "hardhat/src/types/config";
import {number} from "io-ts";

async function main() {
    let actConfig: HardhatNetworkHDAccountsConfig = hre.network.config.accounts as HardhatNetworkHDAccountsConfig;
    console.log("current block: ", await hre.ethers.provider.getBlockNumber())

    const [w1,w2,w3,w4,w5,w6,w7,w8,w9,w10] = GenHDWallets(actConfig.mnemonic, 10);
    console.log("Address", w9.address);
    console.log("PrivateKey", w9.privateKey);
}

main().catch(console.error)