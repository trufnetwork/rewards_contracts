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
    const rewardAddress= process.env.SEPOLIA_REWARD_ADDRESS ?? '';
    assert(rewardAddress, "reward address not set");

    await claim(rewardAddress,
        "",
        "40000000000000000", // 0
        "0x0cd700ac4f7506f24926f5423b2e808b5c8839c9def79e80da0498d057dcc8f8", // 0x...
        "0x63965d172e0ba40e42634aa99aa96b7cfc75c146e585c2d997d5d05d3a92340c", // 0x...
        ["0x6db5d9c555994b9aef499e70315f4e5ab90a2e317f458fc361704fda9f7c1f77"], // [0x...,]
        claimer);
}

main().catch(console.error)