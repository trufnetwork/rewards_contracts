import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { toBigInt, parseUnits, formatEther, formatUnits } from "ethers";
import { zeroAddress } from "ethereumjs-util";
import { IERC20 } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {PANIC_CODES} from "@nomicfoundation/hardhat-chai-matchers/panic";
import {
    genRewardMerkleTree,
    getMTreeProof,
    genRewardLeaf,
    genPostRewardMessageHash,
    genUpdatePosterFeeMessageHash,
    genUpdateSignersMessageHash
} from "../lib.reward";

describe("Sign message", () => {
    it("Should have expect signature", async () => {
        const msg = "sosup";
        const [n, signer1] = await hre.ethers.getSigners();

        expect(await signer1.signMessage(msg))
            .to.equal("0x1fc551d4d1f0901b64432dc59f372beb231adfa2021e1fa5a2cc314df7d98f114ff8afa4603ceee05f768532b615807df8ac358b64b318baaeef5237301240771b")
    });
})

describe("RewardDistributor", function () {
    // setups
    const emptyRewardRoot = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const rewardContractAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
    const posterFee1 = parseUnits("1000000", "gwei")
    const posterFee2 = parseUnits("2000000", "gwei")

    const kwilFirstRewardBlock = toBigInt(100);

    let rewardToken: IERC20;

    // networkOwner: kwil network owner, also the owner of the mock reward token
    let networkOwner: HardhatEthersSigner,
        signer1: HardhatEthersSigner,
        signer2: HardhatEthersSigner,
        signer3: HardhatEthersSigner,
        newSigner4: HardhatEthersSigner,
        rewardPoster: HardhatEthersSigner,
        user1: HardhatEthersSigner,
        user2: HardhatEthersSigner,
        user3: HardhatEthersSigner,
        rewardClaimer: HardhatEthersSigner,
        unknownSigner: HardhatEthersSigner;
    // let reward1: {tree: StandardMerkleTree<any>, root: string, amount: bigint};
    // let reward2: {tree: StandardMerkleTree<any>, root: string, amount: bigint};


    before(async function () {
        [networkOwner, signer1, signer2, signer3, newSigner4, rewardPoster, user1, user2, user3, rewardClaimer, unknownSigner] = await hre.ethers.getSigners();

        const RewardToken = await hre.ethers.getContractFactory("KwilMockToken");
        rewardToken = await RewardToken.connect(networkOwner).deploy(networkOwner);
    });
    
    // ------------

    async function deployRewardContractFixture() {
        const threshold = 2;
        const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");
        const rewardDist = await RewardDist.connect(networkOwner).deploy(
            [signer1, signer2, signer3], threshold, posterFee1, rewardToken);

        return {rewardDist, threshold, posterFee: posterFee1, rewardToken};
    }

    describe("Deployment", function(){
        it("Should revert if too many signers", async () => {
            const threshold = 4;
            const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");
            let newSigners = Array.from({length: 21}, (v, k) => user1.address);

            await expect(RewardDist.connect(networkOwner).deploy(newSigners, threshold, posterFee1, rewardToken))
                .to.be.revertedWith("Too many signers");
        });
        it("Should revert if not enough signer", async function(){
            const threshold = 4;
            const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");

            await expect(RewardDist.connect(networkOwner).deploy([signer1, signer2, signer3], threshold, posterFee1, rewardToken))
                .to.be.revertedWith("Threshold must be less than or equal to the number of signers");
        });

        it("Should reject if threshold is less than zero", async () => {
            const threshold = -2;
            const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");

            await expect(RewardDist.connect(networkOwner).deploy(
                [signer1, zeroAddress(), signer3], threshold, posterFee1, rewardToken)).to.be.rejected;
        });
        it("Should revert if threshold is zero", async () => {
            const threshold = 0;
            const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");

            await expect(RewardDist.connect(networkOwner).deploy(
                [signer1, zeroAddress(), signer3], threshold, posterFee1, rewardToken)).to.be.revertedWith("Threshold must be greater than 0");
        });

        it("Should revert if invalid signer(empty address)", async function(){
            const threshold = 2;
            const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");

            await expect(RewardDist.connect(networkOwner).deploy(
                [signer1, zeroAddress(), signer3], threshold, posterFee1, rewardToken)).to.be.revertedWith("Invalid signer");
        })

        it("Should revert if invalid signer(duplicate)", async function(){
            const threshold = 2;
            const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");

            await expect(RewardDist.connect(networkOwner).deploy(
                [signer1, signer1, signer3], threshold, posterFee1, rewardToken)).to.be.revertedWith("Duplicate signer");
        })

        it("Should init correctly", async function(){
            const {rewardDist, threshold, posterFee, rewardToken} = await loadFixture(deployRewardContractFixture);

            expect(await rewardDist.rewardToken()).changeTokenBalance(rewardToken, rewardDist, 0);


            expect(await rewardDist.posterFee()).to.equal(posterFee);
            expect(await rewardDist.rewardToken()).to.equal(rewardToken);
            expect(await rewardDist.threshold()).to.equal(threshold);


            expect(await rewardDist.isSigner(signer1)).to.equal(true);
            expect(await rewardDist.isSigner(signer2)).to.equal(true);
            expect(await rewardDist.isSigner(signer3)).to.equal(true);
            expect(await rewardDist.isSigner(newSigner4)).to.equal(false);
            //
            // expect(await rewardDist.signers(0)).to.equal(signer1);
            // expect(await rewardDist.signers(1)).to.equal(signer2);
            // expect(await rewardDist.signers(2)).to.equal(signer3);
        });
    });

    async function deployRewardContractAndFund1000TokenFixture() {
        const {rewardDist, threshold, posterFee, rewardToken} = await loadFixture(deployRewardContractFixture);
        await rewardToken.transfer((await rewardDist.getAddress()), parseUnits("1000", "ether"));
        return {rewardDist, threshold, posterFee, rewardToken};
    }

    // post the very first reward, with total 400 on three users
    async function postFirstRewardFixture() {
        const {rewardDist} = await loadFixture(deployRewardContractAndFund1000TokenFixture);

        const contractOldTokenBalance = await rewardToken.balanceOf(rewardDist)

        // generate first reward merkle tree
        const _firstTree = genRewardMerkleTree([user1.address, user2.address, user3.address],
            [100,200,100], await rewardDist.getAddress(), kwilFirstRewardBlock.toString());
        const reward = {tree: _firstTree.tree, root: _firstTree.tree.root, amount: _firstTree.amount};

        const nonce = await rewardDist.nonce();

        const messageHashBytes = genPostRewardMessageHash(reward.root, reward.amount, nonce, (await rewardDist.getAddress()));
        const signature1 = await signer1.signMessage(messageHashBytes);
        const signature2 = await signer2.signMessage(messageHashBytes);
        const signature3 = await signer3.signMessage(messageHashBytes);
        const txResp = await rewardDist.connect(rewardPoster).postReward(
            reward.root,
            reward.amount,
            [signature1, signature2, signature3])

        return {rewardDist, reward, txResp, contractOldTokenBalance};
    }

    // post the very first reward, with total 400 on three users. But the contract has not been funded.
    async function postFirstRewardToNotFundedContractFixture() {
        const {rewardDist} = await loadFixture(deployRewardContractFixture);

        const contractOldTokenBalance = await rewardToken.balanceOf(rewardDist)

        // generate first reward merkle tree
        const _firstTree = genRewardMerkleTree([user1.address, user2.address, user3.address],
            [100,200,100], await rewardDist.getAddress(), kwilFirstRewardBlock.toString());
        const reward = {tree: _firstTree.tree, root: _firstTree.tree.root, amount: _firstTree.amount};

        const nonce = await rewardDist.nonce();
        const messageHashBytes = genPostRewardMessageHash(reward.root, reward.amount, nonce, (await rewardDist.getAddress()));

        const signature1 = await signer1.signMessage(messageHashBytes);
        const signature2 = await signer2.signMessage(messageHashBytes);
        const signature3 = await signer3.signMessage(messageHashBytes);
        const txResp =  await rewardDist.connect(rewardPoster).postReward(
            reward.root,
            reward.amount,
            [signature1, signature2, signature3])

        return {rewardDist, reward, txResp, contractOldTokenBalance};
    }
    
    describe("Post reward", function(){
        it("Should revert if totalAmount less equal than zero", async function(){
            const {rewardDist} = await loadFixture(deployRewardContractAndFund1000TokenFixture);
            await expect(rewardDist.connect(rewardPoster).postReward(emptyRewardRoot, 0, []))
                .to.be.revertedWith("Total amount must be greater than 0");
        });

        it("Should revert if not enough signer", async function(){
            const {rewardDist} = await loadFixture(deployRewardContractAndFund1000TokenFixture);
            await expect(rewardDist.connect(rewardPoster).postReward(emptyRewardRoot, 100, ["0x00"]))
                .to.be.revertedWith("Not enough signatures");
        });

        it("Should revert if reward root already posted", async function(){
            const {rewardDist, reward} = await loadFixture(postFirstRewardFixture);

            await expect(rewardDist.connect(rewardPoster).postReward(reward.root, 100, ["0x00", "0x11"]))
                .to.be.revertedWith("Reward root already posted");
        });

        it("Should revert if reward amount exceeds contract balance", async function(){
            const {rewardDist} = await loadFixture(deployRewardContractAndFund1000TokenFixture);

            const totalRewardBalance = await rewardToken.balanceOf(await rewardDist.getAddress());
            expect(totalRewardBalance).to.equal(parseUnits("1000", "ether"));

            await expect(rewardDist.connect(rewardPoster).postReward(emptyRewardRoot, parseUnits("1001", "ether"), ["0x00", "0x11"]))
                .to.be.revertedWith("Insufficient contract balance for reward amount");
        });

        it("Should revert if any signature is not signed by allowed signer", async function(){
            const {rewardDist} = await loadFixture(deployRewardContractAndFund1000TokenFixture);

            const _firstTree = genRewardMerkleTree([user1.address, user2.address, user3.address],
                [100,200,100], await rewardDist.getAddress(), kwilFirstRewardBlock.toString());
            const reward = {tree: _firstTree.tree, root: _firstTree.tree.root, amount: _firstTree.amount};

            const nonce = await rewardDist.nonce();
            const messageHashBytes = genPostRewardMessageHash(reward.root, reward.amount, nonce, (await rewardDist.getAddress()));

            const signature1 = await signer1.signMessage(messageHashBytes);
            const signature2 = await signer2.signMessage(messageHashBytes);

            const signatureUnknown = await unknownSigner.signMessage(messageHashBytes); // not an allowed signer
            await expect(rewardDist.connect(rewardPoster).postReward(
                reward.root,
                reward.amount,
                [signature1, signature2, signatureUnknown])).to.be.revertedWith("Invalid signer")
        });

        it("Should revert if any signature comes from same signer", async function(){
            const {rewardDist} = await loadFixture(deployRewardContractAndFund1000TokenFixture);

            const _firstTree = genRewardMerkleTree([user1.address, user2.address, user3.address],
                [100,200,100], await rewardDist.getAddress(), kwilFirstRewardBlock.toString());
            // console.log('First Merkle tree:', JSON.stringify(_firstTree.tree.dump()), _firstTree.tree.root);
            const reward = {tree: _firstTree.tree, root: _firstTree.tree.root, amount: _firstTree.amount};

            const nonce = await rewardDist.nonce();
            const messageHashBytes = genPostRewardMessageHash(reward.root, reward.amount, nonce, (await rewardDist.getAddress()));

            const signature1 = await signer1.signMessage(messageHashBytes);
            const signature2 = await signer2.signMessage(messageHashBytes);

            const signature3 = await signer2.signMessage(messageHashBytes); // signed with signer2 again
            await expect(rewardDist.connect(rewardPoster).postReward(
                reward.root,
                reward.amount,
                [signature1, signature2, signature3])).to.be.revertedWith("Duplicate signer")
        });

        it("Should succeed", async function(){
            const {rewardDist, reward, txResp, contractOldTokenBalance} = await loadFixture(postFirstRewardFixture);

            await expect(txResp.wait())
                .to.emit(rewardDist, "RewardPosted")
                .withArgs(reward.root, reward.amount, rewardPoster);
            expect(await rewardDist.rewardPoster(reward.root)).to.equal(rewardPoster.address);
            expect(await rewardDist.postedRewards()).to.equal(reward.amount);
            expect(await rewardDist.nonce()).to.equal(1);
            expect(await rewardDist.unpostedRewards()).to.equal(contractOldTokenBalance - reward.amount);
        });
    });

    async function claimUser1FirstRewardFixture() {
        const {rewardDist, reward} = await loadFixture(postFirstRewardFixture);


        const claimerOldBalance = await hre.ethers.provider.getBalance(rewardClaimer.address);
        const posterOldBalance = await hre.ethers.provider.getBalance(rewardPoster.address);
        const oldTotalPostedReward = await rewardDist.postedRewards();
        const recipient = user1.address;
        const recipientOldTokenBalance = await rewardToken.balanceOf(recipient);
        const contractOldTokenBalance = await rewardToken.balanceOf(rewardDist)

        const amount = toBigInt(100); // need to be the same as what's in the tree.
        const {proof, leaf} = getMTreeProof(reward.tree, recipient);
        const minEthValue = await rewardDist.posterFee();
        const txResp = await rewardDist.connect(rewardClaimer).claimReward(
            recipient, amount, kwilFirstRewardBlock, reward.root, proof, {value: minEthValue});
        return {rewardDist, rewardRoot: reward.root, proof, leaf, recipient, rewardClaimer, amount, txResp,
            paid: minEthValue, claimerOldBalance, posterOldBalance, oldTotalPostedReward,
            recipientOldTokenBalance, contractOldTokenBalance};
    }

    async function claimUser1FirstRewardPay2xFixture() {
        const {rewardDist, reward} = await loadFixture(postFirstRewardFixture);

        const claimerOldBalance = await hre.ethers.provider.getBalance(rewardClaimer.address);
        const posterOldBalance = await hre.ethers.provider.getBalance(rewardPoster.address);
        const oldTotalPostedReward = await rewardDist.postedRewards();
        const recipient = user1.address;
        const recipientOldTokenBalance = await rewardToken.balanceOf(recipient);
        const contractOldTokenBalance = await rewardToken.balanceOf(rewardDist)

        const amount = toBigInt(100); // need to be the same as what's in the tree.
        const {proof, leaf} = getMTreeProof(reward.tree, recipient);
        const minEthValue = await rewardDist.posterFee();
        const txResp = await rewardDist.connect(rewardClaimer).claimReward(
            recipient, amount,kwilFirstRewardBlock, reward.root, proof, {value: minEthValue * toBigInt(2)});

        return {rewardDist, rewardRoot: reward.root, leaf, recipient, rewardClaimer, amount, txResp,
            paid2x: minEthValue*toBigInt(2), claimerOldBalance, posterOldBalance, oldTotalPostedReward,
            recipientOldTokenBalance, contractOldTokenBalance};
    }

    describe("Claim reward", function () {
        it("Should revert if reward root is not posted", async () => {
            const {rewardDist} = await loadFixture(postFirstRewardFixture);

            await expect(rewardDist.connect(rewardClaimer).claimReward(
                user1.address, 100, kwilFirstRewardBlock, emptyRewardRoot, [], {value: 10})).to.be.revertedWith("Reward root not posted");
        });

        it("Should revert if reward already claimed", async function(){
            const {rewardDist, rewardRoot, proof, txResp, recipient, amount, paid} = await loadFixture(claimUser1FirstRewardFixture);
            await expect(txResp.wait()).to.emit(rewardDist, "RewardClaimed").withArgs(recipient, amount, rewardClaimer);

            await expect(rewardDist.connect(rewardClaimer).claimReward(
                recipient, amount, kwilFirstRewardBlock, rewardRoot, proof, {value: paid})).to.be.revertedWith("Reward already claimed");
        });

        it("Should revert if invalid proof(wrong leaf)", async () => {
            const {rewardDist, reward} = await loadFixture(postFirstRewardFixture);

            const recipient = user1.address;
            const amount = toBigInt(50); // not the same as in leaf
            const {proof, leaf} = getMTreeProof(reward.tree, recipient);
            const minEthValue = await rewardDist.posterFee();

            await expect(rewardDist.connect(rewardClaimer).claimReward(
                user1.address, amount, kwilFirstRewardBlock, reward.root, proof, {value: minEthValue})).to.be.revertedWith("Invalid proof");
        });

        it("Should revert if invalid proof(wrong proof)", async () => {
            const {rewardDist, reward} = await loadFixture(postFirstRewardFixture);

            const recipient = user1.address;
            const amount = toBigInt(100);
            const minEthValue = await rewardDist.posterFee();

            await expect(rewardDist.connect(rewardClaimer).claimReward(
                user1.address, amount, kwilFirstRewardBlock, reward.root, [], {value: minEthValue})).to.be.revertedWith("Invalid proof");
        })

        it("Should revert if insufficient payment", async () => {
            const {rewardDist, reward} = await loadFixture(postFirstRewardFixture);

            const recipient = user1.address;
            const amount = toBigInt(100);
            const {proof, leaf} = getMTreeProof(reward.tree, recipient);
            const minEthValue = await rewardDist.posterFee();

            await expect(rewardDist.connect(rewardClaimer).claimReward(
                user1.address, amount, kwilFirstRewardBlock, reward.root, proof, {value: minEthValue - toBigInt(1000)})).to.be.revertedWith("Insufficient payment for poster");
        })

        // TODO: revert if transfer/refund failed, maybe due to insufficient eth balance to continue execute.

        it("Should succeed", async function(){
            const {rewardDist, rewardRoot, leaf, recipient, rewardClaimer, amount, txResp,
                paid, claimerOldBalance, posterOldBalance, oldTotalPostedReward,
                recipientOldTokenBalance, contractOldTokenBalance} = await loadFixture(claimUser1FirstRewardFixture);
            const txReceipt = await txResp.wait();
            expect(txReceipt).to.emit(rewardDist, "RewardClaimed").withArgs(recipient, amount, rewardClaimer);

            // @ts-ignore
            expect(await hre.ethers.provider.getBalance(rewardClaimer.address))
                .to.equal(claimerOldBalance - paid - txReceipt.fee);
            expect(await hre.ethers.provider.getBalance(rewardPoster.address))
                .to.equal(posterOldBalance + paid);
            expect(await rewardDist.isRewardClaimed(rewardRoot, leaf)).to.equal(true);
            expect(await rewardDist.postedRewards()).to.equal(oldTotalPostedReward - amount);
            expect(await rewardToken.balanceOf(recipient)).to.equal(recipientOldTokenBalance + amount);
            expect(await rewardToken.balanceOf(rewardDist)).to.equal(contractOldTokenBalance - amount);
        })

        it("Should succeed with refund", async function(){
            const {rewardDist, rewardRoot, leaf, recipient, rewardClaimer, amount, txResp,
                paid2x, claimerOldBalance, posterOldBalance, oldTotalPostedReward,
                recipientOldTokenBalance, contractOldTokenBalance} = await loadFixture(claimUser1FirstRewardPay2xFixture);
            const txReceipt = await txResp.wait();

            expect(txReceipt).to.emit(rewardDist, "RewardClaimed").withArgs(recipient, rewardClaimer, amount);
            // @ts-ignore
            expect(await hre.ethers.provider.getBalance(rewardClaimer.address))
                .to.equal(claimerOldBalance - paid2x/toBigInt(2) - txReceipt.fee);
            expect(await hre.ethers.provider.getBalance(rewardPoster.address))
                .to.equal(posterOldBalance + paid2x/toBigInt(2));
            expect(await rewardDist.isRewardClaimed(rewardRoot, leaf)).to.equal(true);
            expect(await rewardDist.postedRewards()).to.equal(oldTotalPostedReward - amount);
            expect(await rewardToken.balanceOf(recipient)).to.equal(recipientOldTokenBalance + amount);
            expect(await rewardToken.balanceOf(rewardDist)).to.equal(contractOldTokenBalance - amount);
        })
    })

    async function updatePosterFeeFixture() {
        const {rewardDist} = await loadFixture(deployRewardContractFixture);

        const nonce = await rewardDist.nonce();
        const fee = posterFee2;

        const messageHashBytes = genUpdatePosterFeeMessageHash(fee, nonce, await rewardDist.getAddress());

        const signature1 = await signer1.signMessage(messageHashBytes);
        const signature2 = await signer2.signMessage(messageHashBytes);

        const txResp = await rewardDist.connect(networkOwner).updatePosterFee(
            fee, [signature1, signature2]);
        return {rewardDist, fee, nonce, txResp};
    };

    describe("Update poster fee", () => {
        it("Should revert if fee is less equal than 0", async () => {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            await expect(rewardDist.updatePosterFee(0, [])).to.be.revertedWith("Fee must be greater than 0");
        });

        it("Should revert if not enough signature", async () => {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            await expect(rewardDist.updatePosterFee(11, [])).to.be.revertedWith("Not enough signatures");
        });

        it("Should revert if invalid signer(wrong message)", async () => {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            const nonce = await rewardDist.nonce();
            const rewardAmount = posterFee2;

            const messageHashBytes = genUpdatePosterFeeMessageHash(rewardAmount, nonce + toBigInt(2), await rewardDist.getAddress());

            const signature1 = await signer1.signMessage(messageHashBytes);
            const signature2 = await signer2.signMessage(messageHashBytes);

            await expect(rewardDist.updatePosterFee(rewardAmount, [signature1, signature2]))
                .to.be.revertedWith("Invalid signer");
        });

        it("Should revert if invalid signer(unknown signer)", async () => {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            const nonce = await rewardDist.nonce();
            const rewardAmount = posterFee2;

            const messageHashBytes = genUpdatePosterFeeMessageHash(rewardAmount, nonce + toBigInt(2), await rewardDist.getAddress());

            const signature1 = await signer1.signMessage(messageHashBytes);
            const unknownSig = await unknownSigner.signMessage(messageHashBytes);

            await expect(rewardDist.updatePosterFee(rewardAmount, [signature1, unknownSig]))
                .to.be.revertedWith("Invalid signer");
        });

        it("Should succeed", async function(){
            const {rewardDist, fee, nonce, txResp} = await loadFixture(updatePosterFeeFixture);

            await expect(txResp.wait()).to.emit(rewardDist, "PosterFeeUpdated").withArgs(fee);
            expect(await rewardDist.posterFee()).to.equal(fee);
            expect(await rewardDist.nonce()).to.equal(nonce + toBigInt(1));
        });
    });

    describe("Update signers", function() {
        it("Should revert if too many signers", async () => {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            let newSigners = Array.from({length: 21}, (v, k) => user1.address);

            await expect(rewardDist.connect(networkOwner).updateSigners(newSigners, 3, ["0x00"]))
                .to.be.revertedWith("Too many signers");
        });
        it("Should revert if not enough signers", async () => {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            const newSigners = [signer3.address, newSigner4.address];

            await expect(rewardDist.connect(networkOwner).updateSigners(newSigners, 3, ["0x00"]))
                .to.be.revertedWith("Threshold must be less than or equal to the number of signers");
        });
        it("Should reject if threshold is less than zero", async () => {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            const newSigners = [signer3.address, newSigner4.address];

            await expect(rewardDist.connect(networkOwner).updateSigners(newSigners, -2, ["0x00"])).to.be.rejected;
        });
        it("Should revert if threshold is zero", async () => {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            const newSigners = [signer3.address, newSigner4.address];

            await expect(rewardDist.connect(networkOwner).updateSigners(newSigners, 0, ["0x00"]))
                .to.be.revertedWith("Threshold must be greater than 0");
        });
        it("Should revert if not enough signatures", async () => {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            const newSigners = [signer3.address, newSigner4.address];

            await expect(rewardDist.connect(networkOwner).updateSigners(newSigners, 1, ["0x00"]))
                .to.be.revertedWith("Not enough signatures");
        });
        it("Should revert if invalid signer(wrong message)", async () => {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            const newSigners = [signer3.address, newSigner4.address];
            const newThreshold = 2;
            const nonce = await rewardDist.nonce();
            const messageHashBytes = genUpdateSignersMessageHash(
                newSigners,
                1, // not the same threshold
                nonce,
                await rewardDist.getAddress());
            const signatures = [
                await signer1.signMessage(messageHashBytes),
                await signer2.signMessage(messageHashBytes),
            ]

            await expect(rewardDist.connect(networkOwner).updateSigners(newSigners, newThreshold, signatures))
                .to.be.revertedWith("Invalid signer");
        });
        it("Should revert if invalid signer(unknown signer)", async () => {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            const newSigners = [signer3.address, newSigner4.address];
            const newThreshold = 2;
            const nonce = await rewardDist.nonce();
            const messageHashBytes = genUpdateSignersMessageHash(
                newSigners, newThreshold, nonce, await rewardDist.getAddress());
            const signatures = [
                await signer1.signMessage(messageHashBytes),
                await unknownSigner.signMessage(messageHashBytes),
            ]

            await expect(rewardDist.connect(networkOwner).updateSigners(newSigners, newThreshold, signatures))
                .to.be.revertedWith("Invalid signer");
        });
        it("Should revert if invalid new signer(zero address)", async () => {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            const newSigners = [signer2.address, signer3.address, zeroAddress()]; // with zero address signer
            const newThreshold = 2;
            const nonce = await rewardDist.nonce();
            const messageHashBytes = genUpdateSignersMessageHash(
                newSigners, newThreshold, nonce, await rewardDist.getAddress());
            const signatures = [
                await signer1.signMessage(messageHashBytes),
                await signer2.signMessage(messageHashBytes),
            ]

            await expect(rewardDist.connect(networkOwner).updateSigners(newSigners, newThreshold, signatures))
                .to.be.revertedWith("Invalid new signer");
        });
        it("Should revert if invalid new signer(duplicate)", async () => {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            const newSigners = [signer2.address, signer3.address, signer3.address]; // with zero address signer
            const newThreshold = 2;
            const nonce = await rewardDist.nonce();
            const messageHashBytes = genUpdateSignersMessageHash(
                newSigners, newThreshold, nonce, await rewardDist.getAddress());
            const signatures = [
                await signer1.signMessage(messageHashBytes),
                await signer2.signMessage(messageHashBytes),
            ]

            await expect(rewardDist.connect(networkOwner).updateSigners(newSigners, newThreshold, signatures))
                .to.be.revertedWith("Duplicate new signer");
        });

        it("Should succeed with same number signers", async function() {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            const newSigners = [signer2.address, signer3.address, newSigner4.address];
            const newThreshold = 2;
            const nonce = await rewardDist.nonce();
            const messageHashBytes = genUpdateSignersMessageHash(
                newSigners, newThreshold, nonce, await rewardDist.getAddress());
            const signatures = [
                await signer1.signMessage(messageHashBytes),
                await signer2.signMessage(messageHashBytes),
            ]

            const txResp = await rewardDist.connect(networkOwner).updateSigners(
                newSigners, newThreshold, signatures);

            await expect(txResp.wait()).to.emit(rewardDist, "SignersUpdated").withArgs(newSigners, newThreshold);
            expect(await rewardDist.threshold()).to.equal(newThreshold);
            expect(await rewardDist.isSigner(signer1)).to.equal(false);
            expect(await rewardDist.isSigner(signer2)).to.equal(true);
            expect(await rewardDist.isSigner(signer3)).to.equal(true);
            expect(await rewardDist.isSigner(newSigner4)).to.equal(true);
        });

        it("Should succeed with less signers", async function() {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            const newSigners = [signer3.address, newSigner4.address];
            const newThreshold = 2;
            const nonce = await rewardDist.nonce();
            const messageHashBytes = genUpdateSignersMessageHash(
                newSigners, newThreshold, nonce, await rewardDist.getAddress());
            const signatures = [
                await signer1.signMessage(messageHashBytes),
                await signer2.signMessage(messageHashBytes),
            ]

            const txResp = await rewardDist.connect(networkOwner).updateSigners(
                newSigners, newThreshold, signatures);

            await expect(txResp.wait()).to.emit(rewardDist, "SignersUpdated").withArgs(newSigners, newThreshold);
            expect(await rewardDist.threshold()).to.equal(newThreshold);
            expect(await rewardDist.isSigner(signer1)).to.equal(false);
            expect(await rewardDist.isSigner(signer3)).to.equal(true);
            expect(await rewardDist.isSigner(newSigner4)).to.equal(true);
        });
    });

    describe("Transfer eth", function (){
        it("Should revert if transfer eth with msg.data", async function() {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);
            await expect(unknownSigner.sendTransaction({
                to: rewardDist,
                value: parseUnits("1", "ether"),
                data: "0x00",
            })).to.revertedWith("Ether transfers not allowed");
        });
        it("Should revert if transfer eth without msg.data", async function() {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);
            await expect(unknownSigner.sendTransaction({
                to: rewardDist,
                value: parseUnits("1", "ether"),
            })).to.revertedWith("Ether transfers not allowed");
        });
    });


    // This just show the gas cost with different threshold signature.
    // To simplify tests, threshold = len(merkle tree leafs)
    describe("Gas Fee", function () {
        async function testGasFee(threshold: number) {
            console.log("With threshold(also merkle tree leafs) = ", threshold);
            const _signers = await hre.ethers.getSigners();
            const allSigners = _signers.slice(0, threshold);
            const allSignerAddrs = allSigners.map(signer => signer.address);
            const allAmounts = allSigners.map((_, i) => (i+1)*100);

            // deploy reward contract
            const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");
            const rewardDist = await RewardDist.connect(networkOwner).deploy(
                allSignerAddrs, threshold, posterFee1, rewardToken);
            const deployTxReceipt = await rewardDist.deploymentTransaction().wait();
            console.log(`Deploy contract     `, formatEther(deployTxReceipt.fee),
                ` ether = ${deployTxReceipt.gasUsed} * ${formatUnits(deployTxReceipt.gasPrice, 'gwei')} gwei`);

            // fund reward contract
            await rewardToken.transfer((await rewardDist.getAddress()), parseUnits("1000", "ether"));

            // post reward
            const _firstTree = genRewardMerkleTree(
                allSignerAddrs,
                allAmounts, await rewardDist.getAddress(), kwilFirstRewardBlock.toString());
            const reward = {tree: _firstTree.tree, root: _firstTree.tree.root, amount: _firstTree.amount};
            let nonce = await rewardDist.nonce();
            const messageHashBytes = genPostRewardMessageHash(reward.root, reward.amount, nonce, (await rewardDist.getAddress()));
            const allSigs =  await Promise.all(allSigners.map(async signer => signer.signMessage(messageHashBytes)));
            const postRewardTxResp = await rewardDist.connect(rewardPoster).postReward(
                reward.root,
                reward.amount,
                allSigs);
            const postRewardTxReceipt = await postRewardTxResp.wait();

            console.log(`Post reward Fee     `, formatEther(postRewardTxReceipt.fee),
                ` ether = ${postRewardTxReceipt.gasUsed} * ${formatUnits(postRewardTxReceipt.gasPrice, 'gwei')} gwei`);

            // claim reward (threshold doesn't matter, tree structure matters)
            const recipient = allSignerAddrs[2];
            const amount = toBigInt(300); // need to be the same as what's in the tree.
            const {proof, leaf} = getMTreeProof(reward.tree, recipient);
            const minEthValue = await rewardDist.posterFee();
            const claimRewardTxResp = await rewardDist.connect(rewardClaimer).claimReward(
                recipient, amount, kwilFirstRewardBlock, reward.root, proof, {value: minEthValue});
            const claimRewardTxReceipt = await claimRewardTxResp.wait();

            console.log(`Claim reward Fee    `, formatEther(claimRewardTxReceipt.fee),
                ` ether = ${claimRewardTxReceipt.gasUsed} * ${formatUnits(claimRewardTxReceipt.gasPrice, 'gwei')} gwei`);

            // update poster fee
            nonce = await rewardDist.nonce();
            const fee = posterFee2;
            const updatePosterFeeMessageHashBytes = genUpdatePosterFeeMessageHash(fee, nonce, await rewardDist.getAddress());
            const updatePosterFeeSigs = await Promise.all(
                allSigners.map(async signer => signer.signMessage(updatePosterFeeMessageHashBytes)));
            const updatePosterFeeTxResp = await rewardDist.updatePosterFee(fee, updatePosterFeeSigs);
            const updatePosterFeeTxReceipt = await updatePosterFeeTxResp.wait();

            console.log(`Update posterFee Fee`, formatEther(updatePosterFeeTxReceipt.fee),
                ` ether = ${updatePosterFeeTxReceipt.gasUsed} * ${formatUnits(updatePosterFeeTxReceipt.gasPrice, 'gwei')} gwei`);

            // update signers
            const newSigners = allSignerAddrs.slice(0, allSignerAddrs.length-1); // remove last signer
            const newThreshold = threshold - 1;
            nonce = await rewardDist.nonce();
            const updateSignersMessageHashBytes = genUpdateSignersMessageHash(
                newSigners, newThreshold, nonce, await rewardDist.getAddress());
            const updateSignersSigs = await Promise.all(
                allSigners.map(async signer => signer.signMessage(updateSignersMessageHashBytes)));
            const updateSignersTxResp = await rewardDist.connect(networkOwner).updateSigners(
                newSigners, newThreshold, updateSignersSigs);
            const updateSignersTxReceipt = await updateSignersTxResp.wait();

            console.log(`Update signers Fee  `, formatEther(updateSignersTxReceipt.fee),
                ` ether = ${updateSignersTxReceipt.gasUsed} * ${formatUnits(updateSignersTxReceipt.gasPrice, 'gwei')} gwei`);
        }

        it("threshold 20", async ()=>{
            await testGasFee(20);
        });

        it("threshold 10", async ()=>{
            await testGasFee(10);
        });

        it("threshold 5", async ()=>{
            await testGasFee(5);
        });
    })

    // hardhat config:
    //   solidity: {
    //     version: "0.8.27",
    //     settings: {
    //       optimizer: {
    //         enabled: true,
    //         runs: 200
    //       },
    //       evmVersion: `paris`, // https://github.com/NomicFoundation/hardhat/issues/4232
    //     }
    //   },
    //
    //    Gas Fee
    // With threshold(also merkle tree leafs) =  20
    // Deploy contract      0.002561684  ether = 2561684 * 1.0 gwei
    // Post reward Fee      0.000302966  ether = 302966 * 1.0 gwei
    // Claim reward Fee     0.000106189  ether = 106189 * 1.0 gwei
    // Update posterFee Fee 0.000195486  ether = 195486 * 1.0 gwei
    // Update signers Fee   0.000301353  ether = 301353 * 1.0 gwei
    //       ✔ threshold 20 (52ms)
    // With threshold(also merkle tree leafs) =  10
    // Deploy contract      0.002106806  ether = 2106806 * 1.0 gwei
    // Post reward Fee      0.000191018  ether = 191018 * 1.0 gwei
    // Claim reward Fee     0.000088342  ether = 88342 * 1.0 gwei
    // Update posterFee Fee 0.000115621  ether = 115621 * 1.0 gwei
    // Update signers Fee   0.000167811  ether = 167811 * 1.0 gwei
    //       ✔ threshold 10 (44ms)
    // With threshold(also merkle tree leafs) =  5
    // Deploy contract      0.001879361  ether = 1879361 * 1.0 gwei
    // Post reward Fee      0.000142632  ether = 142632 * 1.0 gwei
    // Claim reward Fee     0.000086824  ether = 86824 * 1.0 gwei
    // Update posterFee Fee 0.000075638  ether = 75638 * 1.0 gwei
    // Update signers Fee   0.00010097  ether = 100970 * 1.0 gwei
    //       ✔ threshold 5
});
