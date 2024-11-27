import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import {toBigInt, parseUnits, formatEther, formatUnits, ethers} from "ethers";
import { zeroAddress } from "ethereumjs-util";
import { IERC20 } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
    genRewardMerkleTree,
    getMTreeProof,
} from "../peripheral/lib/reward";

describe("Sign message", () => {
    it("Should have expect signature", async () => {
        const msg = "sosup";
        const [n, signer1] = await hre.ethers.getSigners();

        expect(await signer1.signMessage(msg))
            .to.equal("0x1fc551d4d1f0901b64432dc59f372beb231adfa2021e1fa5a2cc314df7d98f114ff8afa4603ceee05f768532b615807df8ac358b64b318baaeef5237301240771b")
    });
})

// Unit tests on RewardDistributor contract, without using GnosisSafe.
// Thus the safe wallet will be acting as poster wallet, e.g.
// `safe -> rewardContract` instead of `poster -> safe -> rewardContract`
describe("RewardDistributor UnitTest", function () {
    if  (hre.network.name != "hardhat") {
        console.log("Only work on forking network. Skip on network: " + hre.network.name);
        return;
    }

    // setups
    const emptyRewardRoot = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const rewardContractAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
    const posterFee1 = parseUnits("1000000", "gwei")
    const posterFee2 = parseUnits("2000000", "gwei")

    const kwilFirstRewardBlock = toBigInt(100);

    let rewardToken: IERC20;
    let rewardAddress: string;

    // networkOwner: kwil network owner, also the owner of the mock reward token
    let networkOwner: HardhatEthersSigner,
        gnosisSafe: HardhatEthersSigner, // mimic the safe wallet; also act as gnosisSafe
        user1: HardhatEthersSigner,
        user2: HardhatEthersSigner,
        user3: HardhatEthersSigner,
        rewardClaimer: HardhatEthersSigner;

    before(async function () {
        [networkOwner, gnosisSafe,
            user1, user2, user3, rewardClaimer] = await hre.ethers.getSigners();

        const RewardToken = await hre.ethers.getContractFactory("KwilMockToken");
        rewardToken = await RewardToken.connect(networkOwner).deploy(networkOwner);
    });

    // ------------

    async function deployRewardContractFixture() {
        const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");
        const rewardDist = await RewardDist.connect(networkOwner).deploy(
            gnosisSafe, posterFee1, rewardToken);

        rewardAddress = await  rewardDist.getAddress();
        return {rewardDist, posterFee: posterFee1, rewardToken};
    }

    describe("Deployment", function(){
        it("Should revert if invalid safe(empty address)", async function(){
            const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");

            await expect(RewardDist.connect(networkOwner).deploy(
                zeroAddress(), posterFee1, rewardToken)).to.be.revertedWith("ZERO ADDRESS");
        })

        it("Should revert if invalid rewardToken(empty address)", async function(){
            const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");

            await expect(RewardDist.connect(networkOwner).deploy(
                gnosisSafe, posterFee1, zeroAddress())).to.be.revertedWith("ZERO ADDRESS");
        })

        it("Should revert if posterFee = 0", async function(){
            const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");

            await expect(RewardDist.connect(networkOwner).deploy(
                gnosisSafe, 0, rewardToken)).to.be.revertedWith("PostFee zero");
        })

        it("Should init correctly", async function(){
            const {rewardDist, posterFee, rewardToken} = await loadFixture(deployRewardContractFixture);

            expect(await rewardDist.rewardToken()).changeTokenBalance(rewardToken, rewardDist, 0);
            expect(await rewardDist.posterFee()).to.equal(posterFee);
            expect(await rewardDist.rewardToken()).to.equal(rewardToken);
            expect(await rewardDist.safe()).to.equal(gnosisSafe.address);
        });
    });

    async function deployRewardContractAndFund1000TokenFixture() {
        const {rewardDist, posterFee, rewardToken} = await loadFixture(deployRewardContractFixture);
        await rewardToken.transfer((await rewardDist.getAddress()), parseUnits("1000", "ether"));
        return {rewardDist, posterFee, rewardToken};
    }

    // post the very first reward, with total 400 on three users
    async function postFirstRewardFixture() {
        const {rewardDist} = await loadFixture(deployRewardContractAndFund1000TokenFixture);

        const contractOldTokenBalance = await rewardToken.balanceOf(rewardDist)
        const oldPostedRewards = await rewardDist.postedRewards();

        // generate first reward merkle tree
        const _firstTree = genRewardMerkleTree([user1.address, user2.address, user3.address],
            [100,200,100], await rewardDist.getAddress(), kwilFirstRewardBlock.toString());
        const reward = {tree: _firstTree.tree, root: _firstTree.tree.root, amount: _firstTree.amount, user1Amount: 100};

        const txResp = await rewardDist.connect(gnosisSafe).postReward(
            reward.root,
            reward.amount)

        return {rewardDist, reward, txResp, contractOldTokenBalance, oldPostedRewards};
    }

    // post the very first reward, with total 400 on three users. But the contract has not been funded.
    async function postFirstRewardToNotFundedContractFixture() {
        const {rewardDist} = await loadFixture(deployRewardContractFixture);

        const contractOldTokenBalance = await rewardToken.balanceOf(rewardDist)

        // generate first reward merkle tree
        const _firstTree = genRewardMerkleTree([user1.address, user2.address, user3.address],
            [100,200,100], await rewardDist.getAddress(), kwilFirstRewardBlock.toString());
        const reward = {tree: _firstTree.tree, root: _firstTree.tree.root, amount: _firstTree.amount};

        const txResp =  await rewardDist.connect(gnosisSafe).postReward(
            reward.root,
            reward.amount)

        return {rewardDist, reward, txResp, contractOldTokenBalance};
    }

    describe("Post reward", function(){
        it("Should revert if transaction is not send from safe", async function(){
            const {rewardDist} = await loadFixture(deployRewardContractAndFund1000TokenFixture);
            await expect(rewardDist.connect(networkOwner).postReward(emptyRewardRoot, 0))
                .to.be.revertedWith("Not allowed");
        });

        it("Should revert if totalAmount is zero", async function(){
            const {rewardDist} = await loadFixture(deployRewardContractAndFund1000TokenFixture);
            await expect(rewardDist.connect(gnosisSafe).postReward(emptyRewardRoot, 0))
                .to.be.revertedWith("Total amount zero");
        });

        it("Should revert if reward root already posted (or replay)", async function(){
            const {rewardDist, reward} = await loadFixture(postFirstRewardFixture);

            await expect(rewardDist.connect(gnosisSafe).postReward(reward.root, reward.amount))
                .to.be.revertedWith("Already posted");
        });

        it("Should revert if reward amount exceeds contract balance", async function(){
            const {rewardDist} = await loadFixture(deployRewardContractAndFund1000TokenFixture);

            const totalRewardBalance = await rewardToken.balanceOf(await rewardDist.getAddress());
            expect(totalRewardBalance).to.equal(parseUnits("1000", "ether"));

            await expect(rewardDist.connect(gnosisSafe).postReward(emptyRewardRoot, parseUnits("1001", "ether")))
                .to.be.revertedWith("Insufficient contract reward balance");
        });

        it("Should succeed", async function(){
            const {rewardDist, reward, txResp, contractOldTokenBalance, oldPostedRewards} = await loadFixture(postFirstRewardFixture);

            await expect(txResp.wait())
                .to.emit(rewardDist, "RewardPosted")
                .withArgs(reward.root, reward.amount, gnosisSafe);
            expect(await rewardDist.rewardPoster(reward.root)).to.equal(gnosisSafe.address);
            expect(await rewardDist.postedRewards()).to.equal(reward.amount + oldPostedRewards);
            expect(await rewardDist.nonce()).to.equal(0);
            expect(await rewardDist.unpostedRewards()).to.equal(contractOldTokenBalance - reward.amount);
        });
    });

    async function claimUser1FirstRewardFixture() {
        const {rewardDist, reward} = await loadFixture(postFirstRewardFixture);

        const claimerOldBalance = await hre.ethers.provider.getBalance(rewardClaimer.address);
        const posterOldBalance = await hre.ethers.provider.getBalance(gnosisSafe.address);
        const oldTotalPostedReward = await rewardDist.postedRewards();
        const recipient = user1.address;
        const recipientOldTokenBalance = await rewardToken.balanceOf(recipient);
        const contractOldTokenBalance = await rewardToken.balanceOf(rewardDist)

        const amount = toBigInt(reward.user1Amount);
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
        const posterOldBalance = await hre.ethers.provider.getBalance(gnosisSafe.address);
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
                user1.address, amount, kwilFirstRewardBlock, reward.root, proof, {value: minEthValue - toBigInt(1000)}))
                .to.be.revertedWith("Insufficient payment for poster");
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
                .to.equal(claimerOldBalance - paid - txReceipt!.fee);
            expect(await hre.ethers.provider.getBalance(gnosisSafe.address))
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
                .to.equal(claimerOldBalance - paid2x/toBigInt(2) - txReceipt!.fee);
            expect(await hre.ethers.provider.getBalance(gnosisSafe.address))
                .to.equal(posterOldBalance + paid2x/toBigInt(2));
            expect(await rewardDist.isRewardClaimed(rewardRoot, leaf)).to.equal(true);
            expect(await rewardDist.postedRewards()).to.equal(oldTotalPostedReward - amount);
            expect(await rewardToken.balanceOf(recipient)).to.equal(recipientOldTokenBalance + amount);
            expect(await rewardToken.balanceOf(rewardDist)).to.equal(contractOldTokenBalance - amount);
        })
    })

    async function updatePosterFeeFixture() {
        const {rewardDist} = await loadFixture(deployRewardContractFixture);

        const oldNonce = await rewardDist.nonce();
        const fee = posterFee2;
        const txResp = await rewardDist.connect(gnosisSafe).updatePosterFee(
            fee, oldNonce);
        return {rewardDist, fee, oldNonce, txResp};
    };

    describe("Update poster fee", () => {
        it("Should revert if not from safe wallet", async () => {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            await expect(rewardDist.connect(networkOwner).updatePosterFee(0,0)).to.be.revertedWith("Not allowed");
        });

        it("Should revert if fee is 0", async () => {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            await expect(rewardDist.connect(gnosisSafe).updatePosterFee(0, 0)).to.be.revertedWith("Fee zero");
        });

        it("Should revert if nonce is not correct(or replay)", async () => {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            await expect(rewardDist.connect(gnosisSafe).updatePosterFee(1,100)).to.be.revertedWith("Nonce does not match");
        });

        it("Should succeed", async function(){
            const {rewardDist, fee, oldNonce, txResp} = await loadFixture(updatePosterFeeFixture);

            await expect(txResp.wait()).to.emit(rewardDist, "PosterFeeUpdated").withArgs(fee, oldNonce);
            expect(await rewardDist.posterFee()).to.equal(fee);
            expect(await rewardDist.nonce()).to.equal(oldNonce + toBigInt(1));
        });
    });

    describe("Transfer eth", function (){
        it("Should revert if transfer eth with msg.data", async function() {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);
            await expect(networkOwner.sendTransaction({
                to: rewardDist,
                value: parseUnits("1", "ether"),
                data: "0x00",
            })).to.revertedWith("Ether transfers not allowed");
        });
        it("Should revert if transfer eth without msg.data", async function() {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);
            await expect(networkOwner.sendTransaction({
                to: rewardDist,
                value: parseUnits("1", "ether"),
            })).to.revertedWith("Ether transfers not allowed");
        });
    });


    // This just show the gas cost with different threshold signature.
    // To simplify tests, threshold = len(merkle tree leafs)
    describe("Gas Fee without GnosisSafe", function () {
        async function testGasFee(threshold: number) {
            console.log("With threshold(also merkle tree leafs) = ", threshold);
            const _signers = await hre.ethers.getSigners();
            const allSigners = _signers.slice(0, threshold);
            const allSignerAddrs = allSigners.map(signer => signer.address);
            const allAmounts = allSigners.map((_, i) => (i+1)*100);

            // deploy reward contract
            const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");
            const rewardDist = await RewardDist.connect(networkOwner).deploy(
                gnosisSafe, posterFee1, rewardToken);
            const deployTxReceipt = await rewardDist.deploymentTransaction()!.wait();
            console.log(`Deploy contract     `, formatEther(deployTxReceipt!.fee),
                ` ether = ${deployTxReceipt!.gasUsed} * ${formatUnits(deployTxReceipt!.gasPrice, 'gwei')} gwei`);

            // fund reward contract
            await rewardToken.transfer((await rewardDist.getAddress()), parseUnits("1000", "ether"));

            // post reward
            const _firstTree = genRewardMerkleTree(
                allSignerAddrs,
                allAmounts, await rewardDist.getAddress(), kwilFirstRewardBlock.toString());
            const reward = {tree: _firstTree.tree, root: _firstTree.tree.root, amount: _firstTree.amount};
            const postRewardTxResp = await rewardDist.connect(gnosisSafe).postReward(
                reward.root,
                reward.amount,);
            const postRewardTxReceipt = await postRewardTxResp.wait();

            console.log(`Post reward Fee     `, formatEther(postRewardTxReceipt!.fee),
                ` ether = ${postRewardTxReceipt!.gasUsed} * ${formatUnits(postRewardTxReceipt!.gasPrice, 'gwei')} gwei`);

            // claim reward (threshold doesn't matter, tree structure matters)
            const recipient = allSignerAddrs[2];
            const amount = toBigInt(300); // need to be the same as what's in the tree.
            const {proof, leaf} = getMTreeProof(reward.tree, recipient);
            const minEthValue = await rewardDist.posterFee();
            const claimRewardTxResp = await rewardDist.connect(rewardClaimer).claimReward(
                recipient, amount, kwilFirstRewardBlock, reward.root, proof, {value: minEthValue});
            const claimRewardTxReceipt = await claimRewardTxResp.wait();

            console.log(`Claim reward Fee    `, formatEther(claimRewardTxReceipt!.fee),
                ` ether = ${claimRewardTxReceipt!.gasUsed} * ${formatUnits(claimRewardTxReceipt!.gasPrice, 'gwei')} gwei`);

            // update poster fee
            let nonce = await rewardDist.nonce();
            const fee = posterFee2;
            const updatePosterFeeTxResp = await rewardDist.connect(gnosisSafe).updatePosterFee(fee, nonce);
            const updatePosterFeeTxReceipt = await updatePosterFeeTxResp.wait();

            console.log(`Update posterFee Fee`, formatEther(updatePosterFeeTxReceipt!.fee),
                ` ether = ${updatePosterFeeTxReceipt!.gasUsed} * ${formatUnits(updatePosterFeeTxReceipt!.gasPrice, 'gwei')} gwei`);
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
    //     Gas Fee without GnosisSafe
    // With threshold(also merkle tree leafs) =  20
    // Deploy contract      0.000946555072012326  ether = 905858 * 1.044926547 gwei
    // Post reward Fee      0.000078777697850205  ether = 76135 * 1.034710683 gwei
    // Claim reward Fee     0.000108563328642431  ether = 105361 * 1.030393871 gwei
    // Update posterFee Fee 0.000054121422958632  ether = 52718 * 1.026621324 gwei
    //       ✔ threshold 20
    // With threshold(also merkle tree leafs) =  10
    // Deploy contract      0.000926969341363732  ether = 905858 * 1.023305354 gwei
    // Post reward Fee      0.0000775058822419  ether = 76135 * 1.01800594 gwei
    // Claim reward Fee     0.000088881610958244  ether = 87502 * 1.015766622 gwei
    // Update posterFee Fee 0.000053445892819656  ether = 52718 * 1.013807292 gwei
    //       ✔ threshold 10 (1356ms)
    // With threshold(also merkle tree leafs) =  5
    // Deploy contract      0.000916807510564526  ether = 905858 * 1.012087447 gwei
    // Post reward Fee      0.000076846015552665  ether = 76135 * 1.009338879 gwei
    // Claim reward Fee     0.000087442254337185  ether = 86733 * 1.008177445 gwei
    // Update posterFee Fee 0.00005309552282365  ether = 52718 * 1.007161175 gwei
    //       ✔ threshold 5 (1105ms)
    //
});
