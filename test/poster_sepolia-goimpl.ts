import hre from "hardhat";
import { expect, assert } from "chai";
import {EVMPoster} from "../peripheral/poster/poster";
import {KwilReward, Reward} from "../peripheral/poster/state";
import {GenHDWallets} from "../peripheral/lib/wallet";
import {toBigInt, parseUnits, formatEther, formatUnits, ethers, Numeric} from "ethers";
import {RewardSafe} from "../peripheral/lib/gnosis";
import fs from "fs";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function base64ToHex(s: string): string {
    return '0x' + Buffer.from(s, 'base64').toString('hex')
}

function parseGoReward(jsonStr: string, decimals: bigint): Reward {
    let finalizedReward  = JSON.parse(jsonStr);

    console.log("==========safeNonce !!!!", finalizedReward.SafeNonce);


    const signaturesInHex = finalizedReward.Signatures.map(
        // (sig: string) => '0x' + Buffer.from(sig, 'base64').toString('hex')
        base64ToHex
    );

    let amount = parseUnits(finalizedReward.TotalRewards, decimals);

    const reward: KwilReward = {
        root: base64ToHex(finalizedReward.RewardRoot),
        // root: '0x' + Buffer.from(finalizedReward.RewardRoot, 'base64').toString('hex'),
        amount: amount.toString(),
        signers: finalizedReward.Voters,
        signatures: signaturesInHex,
        createdAt: finalizedReward.EndHeight, // the height when epoch reward is created
    };
    return {
        request: reward
    };
}
describe("Poster with GnosisSafe, with API from goimpl", () => {
    if (hre.network.name != "sepolia") {
        console.log("Skip test on network: " + hre.network.name);
        return;
    }

    const rewardJSON = fs.readFileSync("./test/testdata/.go_finalized_reward.json", "utf-8");
    let rawProof = ["JDw3WoTESh1Qecsk0ye3ejO1r4vVbNab7OSnb4GcMiM="];
    let proof = rawProof.map(base64ToHex);

    const chainID = 11155111n;
    const mnemonic = process.env.SEPOLIA_MNEMONIC ?? '';
    assert(mnemonic, "mnemonic not set");

    const alchemyApiKey = process.env.ALCHEMY_API_KEY;
    const rpcURL = `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;
    const safeAddress = process.env.SEPOLIA_SAFE_ADDRESS ?? '';
    assert(safeAddress, "safe address not set");
    const rewardAddress= process.env.SEPOLIA_REWARD_ADDRESS ?? '';
    assert(rewardAddress, "reward address not set");

    // we use GenHDWallets instead of hre.ethers.getSigners() because we need private key
    // NOTE: ceo/cfo/eng are signers, eng are also user
    const [ceo, cfo, eng, poster] = GenHDWallets(mnemonic);


    it("Should a reward be claimed and posted", async () => {
        const rd = await hre.ethers.getContractAt("RewardDistributor", rewardAddress);
        const rewardTokenAddress = await rd.rewardToken();
        const rewardToken = await hre.ethers.getContractAt("ERC20", rewardTokenAddress);

        const tokenDecimal = await rewardToken.decimals();

        const oldPostedReward = await rd.postedRewards();


        const eth = new ethers.JsonRpcProvider(rpcURL);
        const rewardSafe = new RewardSafe(rpcURL, chainID, safeAddress, rewardAddress);

        // const state = State.LoadStateFromFile("/tmp/uploadState.json");
        const p = new EVMPoster(
            rewardSafe,
            rewardAddress,
            poster.privateKey,
            poster.address,
            null, // we don't need
            eth,
            // we use in-memory state for Poster
        )

        let reward = parseGoReward(rewardJSON, tokenDecimal);
        // console.log("==========sig", reward.request.signatures[0]);
        // console.log("==========root", reward.request.root);
        // console.log("==========amount", reward.request.amount);
        // console.log("==========signers", reward.request.signers);
        // console.log("==========createdAt", reward.request.createdAt);
        console.log(`a Kwil reward at Kwil block height ${reward.request.createdAt} with ${reward.request.amount} reward tokens`);


        const treeRoot = reward.request.root;

        // ///////// post reward
        // await p.postReward(reward, 0, false)
        // await delay(200000);
        // let totalReward = reward.request.amount;
        // expect(await rd.rewardPoster(treeRoot)).to.be.equal(poster.address);
        // expect(await rd.postedRewards()).to.equal(oldPostedReward + BigInt(totalReward));
        // /////////


        //////////
        // user's reward amount, not the total reward amount
        let userRewardAmount = "0.02"
        /////////

        // User should be able to claim the reward
        const posterSigner = new hre.ethers.Wallet(poster.privateKey, hre.ethers.provider);
        const recipientRewardAmount = parseUnits(userRewardAmount, tokenDecimal);;
        let recipient = ceo.address
        let kwilBlockHeight = reward.request.createdAt;
        console.log("==========recipientRewardAmount", recipientRewardAmount);
        console.log("==========poster", poster.address)
        console.log("==========recipient", recipient)
        console.log("==========treeRoot", treeRoot);
        console.log("==========kwilBlockHeight", kwilBlockHeight);
        console.log("==========proof", proof);

        const oldPosterEthBalance = await hre.ethers.provider.getBalance(poster.address);
        const oldRewardContactTokenBalance = await rewardToken.balanceOf(rewardAddress);
        const oldRecipientTokenBalance = await rewardToken.balanceOf(recipient);

        const txResp1 = await rd.connect(posterSigner).claimReward(recipient, recipientRewardAmount, kwilBlockHeight, treeRoot, proof,
            {value: hre.ethers.parseUnits("0.002", "ether")})
        await expect(txResp1.wait()).to.emit(rd, "RewardClaimed").withArgs(recipient, recipientRewardAmount, poster.address);
        expect(await rewardToken.balanceOf(recipient)).to.equal(oldRecipientTokenBalance + BigInt(recipientRewardAmount));
        expect(await rewardToken.balanceOf(rewardAddress)).to.equal(oldRewardContactTokenBalance - BigInt(recipientRewardAmount));

        // should not be able to claim the reward again
        await expect(rd.connect(posterSigner).claimReward(recipient, recipientRewardAmount, kwilBlockHeight, treeRoot, proof,
            {value: hre.ethers.parseUnits("0.002", "ether")})).to.be.revertedWith("Reward already claimed");
    }).timeout(600000);
})