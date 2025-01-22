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

async function claim(rewardAddress: string, recipient: string, treeRoot: string = "0x", rewardAmount: string = "0.0", kwilBlockHeight: number, claimer: HardhatEthersSigner) {
    const rd = await hre.ethers.getContractAt("RewardDistributor", rewardAddress);
    const rewardTokenAddress = await rd.rewardToken();
    const rewardToken = await hre.ethers.getContractAt("ERC20", rewardTokenAddress);

    // User should be able to claim the reward
    // const proof = await kwil.getRewardProof(treeRoot, recipient);
    // TODO
    let rawProof = ["JDw3WoTESh1Qecsk0ye3ejO1r4vVbNab7OSnb4GcMiM="];
    let proof = rawProof.map(base64ToHex);

    const txResp1 = await rd.connect(claimer).claimReward(recipient, rewardAmount, kwilBlockHeight, treeRoot, proof,
        {value: hre.ethers.parseUnits("0.002", "ether")})
}

async function main() {
    if (hre.network.name != "sepolia") {
        console.log("Skip test on network: " + hre.network.name);
        return;
    }

    let actConfig: HardhatNetworkHDAccountsConfig = hre.network.config.accounts as HardhatNetworkHDAccountsConfig;
    console.log("current block: ", await hre.ethers.provider.getBlockNumber())

    // we use GenHDWallets here because we need private key
    // NOTE: ceo/cfo/eng are signers, 'eng' are also user
    const [ceo, cfo, eng, poster] = GenHDWallets(actConfig.mnemonic);
    // as long as the signer has Sepolia ETH
    const signer = (await hre.ethers.getSigners())[3];

    const safeAddress = process.env.SEPOLIA_SAFE_ADDRESS ?? '';
    assert(safeAddress, "safe address not set");
    const rewardAddress= process.env.SEPOLIA_REWARD_ADDRESS ?? '';
    assert(rewardAddress, "reward address not set");

    await claim(rewardAddress,
        poster.address,
        "", // 0x...
        "", // 0.0
        0, //
        signer);
}

main().catch(console.error)