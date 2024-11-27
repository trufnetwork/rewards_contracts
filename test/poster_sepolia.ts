import hre from "hardhat";
import { expect, assert } from "chai";
import {EVMPoster} from "../peripheral/poster/poster";
import {GenHDWallets} from "../peripheral/lib/wallet";
import {MockKwilApi} from "./mock_kwil_api";
import {ethers, toBigInt} from "ethers";
import {RewardSafe} from "../peripheral/lib/gnosis";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
describe("Poster with GnosisSafe", () => {
    if (hre.network.name != "sepolia") {
        console.log("Skip test on network: " + hre.network.name);
        return;
    }

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

    it("Should a reward be posted and claimed", async () => {
        const rd = await hre.ethers.getContractAt("RewardDistributor", rewardAddress);
        const rewardTokenAddress = await rd.rewardToken();
        const rewardToken = await hre.ethers.getContractAt("ERC20", rewardTokenAddress);

        const oldPostedReward = await rd.postedRewards();

        const kwilBlockHeight = 18; // change this to generate a unique Kwil reward
        const userRewardAmount = 11;
        console.log(`stub a Kwil reward at Kwil block height ${kwilBlockHeight} with ${userRewardAmount} reward tokens`);

        const kwil = new MockKwilApi(
            [ceo.privateKey, cfo.privateKey, eng.privateKey],
            [ceo.address, cfo.address, eng.address],
            [eng.address], [userRewardAmount],
            rpcURL, chainID, safeAddress, rewardAddress,
            // configure rewardEvery equals block, thus produce a reward
            kwilBlockHeight, kwilBlockHeight);


        const eth = new ethers.JsonRpcProvider(rpcURL);
        const rewardSafe = new RewardSafe(rpcURL, chainID, safeAddress, rewardAddress);

        // const state = State.LoadStateFromFile("/tmp/uploadState.json");
        const p = new EVMPoster(
            rewardSafe,
            rewardAddress,
            poster.privateKey,
            poster.address,
            kwil,
            eth,
            // we use in-memory state for Poster
        )

        // Poster calls GnosisSafe and RewardDistributor
        await p.fetchPendingRewards();
        await p.checkRewardPostingStatus(); // post reward
        await delay(60000);
        await p.checkRewardPostingStatus(); // ensure TX is included (NOTE: not confirmed)
        await delay(10000);

        // verify contract state
        const treeRoot = Object.keys(kwil.trees)[0];
        expect(await rd.rewardPoster(treeRoot)).to.be.equal(poster.address);
        expect(await rd.postedRewards()).to.equal(oldPostedReward + BigInt(userRewardAmount));

        // User should be able to claim the reward
        const proof = await kwil.getRewardProof(treeRoot, eng.address);
        const posterSigner = new hre.ethers.Wallet(poster.privateKey, hre.ethers.provider);

        const oldPosterEthBalance = await hre.ethers.provider.getBalance(poster.address);
        const oldRewardContactTokenBalance = await rewardToken.balanceOf(rewardAddress);
        const oldEngTokenBalance = await rewardToken.balanceOf(eng.address);

        const txResp1 = await rd.connect(posterSigner).claimReward(eng.address, userRewardAmount, kwilBlockHeight, treeRoot, proof,
            {value: hre.ethers.parseUnits("0.002", "ether")})
        await expect(txResp1.wait()).to.emit(rd, "RewardClaimed").withArgs(eng.address, userRewardAmount, poster.address);
        expect(await rewardToken.balanceOf(eng.address)).to.equal(oldEngTokenBalance + BigInt(userRewardAmount));
        expect(await rewardToken.balanceOf(rewardAddress)).to.equal(oldRewardContactTokenBalance - BigInt(userRewardAmount));

        // should not be able to claim the reward again
        await expect(rd.connect(posterSigner).claimReward(eng.address, userRewardAmount, kwilBlockHeight, treeRoot, proof,
            {value: hre.ethers.parseUnits("0.002", "ether")})).to.be.revertedWith("Reward already claimed");
    }).timeout(600000);
})