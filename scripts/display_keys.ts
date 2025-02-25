import hre from "hardhat";
import {GenHDWallets} from "../peripheral/lib/wallet";
import {HardhatNetworkHDAccountsConfig} from "hardhat/src/types/config";
import {number} from "io-ts";

async function main() {
    let actConfig: HardhatNetworkHDAccountsConfig = hre.network.config.accounts as HardhatNetworkHDAccountsConfig;
    console.log("current block: ", await hre.ethers.provider.getBlockNumber())

    const [ceo, cfo, eng, poster] = GenHDWallets(actConfig.mnemonic, 4);
    console.log("Address", poster.address);
    console.log("PrivateKey", poster.privateKey);
}

main().catch(console.error)