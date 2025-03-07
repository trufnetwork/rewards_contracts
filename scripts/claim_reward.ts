import hre from "hardhat";
import { expect, assert } from "chai"
import {GenHDWallets} from "../peripheral/lib/wallet";
import {ethers, toBigInt} from "ethers";
import {HardhatNetworkHDAccountsConfig} from "hardhat/src/types/config";
import {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function base64ToHex(s: string): string {
    return '0x' + Buffer.from(s, 'base64').toString('hex')
}

async function claim(rewardAddress: string,
                     recipient: string,
                     rewardAmount: string = "0",
                     kwilBlockHash: string = "0x",
                     treeRoot: string = "0x",
                     proofs: string[],
                     claimer: HardhatEthersSigner,
                     txValue: string = "0.02") {
    const rd = await hre.ethers.getContractAt("RewardDistributor", rewardAddress);
    const rewardTokenAddress = await rd.rewardToken();
    const rewardToken = await hre.ethers.getContractAt("ERC20", rewardTokenAddress);
    const txResp = await rd.connect(claimer).claimReward(recipient, rewardAmount, kwilBlockHash, treeRoot, proofs,
        {value: hre.ethers.parseUnits(txValue, "ether")})
    console.log("txResp: ", txResp);

    const txReceipt = await txResp.wait();
    console.log("txReceipt: ", txReceipt);
}

async function main() {
    if (hre.network.name != "sepolia") {
        console.log("Skip test on network: " + hre.network.name);
        return;
    }

    let actConfig: HardhatNetworkHDAccountsConfig = hre.network.config.accounts as HardhatNetworkHDAccountsConfig;
    console.log("current block: ", await hre.ethers.provider.getBlockNumber())

    // as long as the signer has Sepolia ETH
    const claimer = (await hre.ethers.getSigners())[0];

    const safeAddress = process.env.SEPOLIA_SAFE_ADDRESS ?? '';
    assert(safeAddress, "safe address not set");
    const escrowAddress= process.env.SEPOLIA_ESCROW_ADDRESS ?? '';
    assert(escrowAddress, "escrow address not set");

    await claim(escrowAddress,
        "0x640568976c2CDc8789E44B39369D5Bc44B1e6Ad7",
        "40000000000000000", // 0
        "0xe0453b16230d1b4c49800f73e0688d6b6cf3935094a1be83567b9381c249207e", // 0x...
        "0x2e5119b73b5e2dd7ba06a25a92aa6900552c86378f4cf1e639d892194454b804", // 0x...
        ["0xe737432648ae7ca95e3c0d80b698765b88a74e5d96fccfca6bbd219298a271eb"], // [0x...,]
        claimer);
}

main().catch(console.error)