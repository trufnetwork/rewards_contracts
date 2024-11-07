import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { keccak256, AbiCoder, toBigInt, toQuantity, getBytes, parseUnits, parseEther, formatEther, formatUnits } from "ethers";
import { zeroAddress } from "ethereumjs-util";
import { IERC20 } from "../typechain-types";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { standardLeafHash } from "@openzeppelin/merkle-tree/dist/hashes";
import {PANIC_CODES} from "@nomicfoundation/hardhat-chai-matchers/panic";

import fs from "fs";

import {MerkleTree} from "merkletreejs";


const abiCode = new AbiCoder();

// generate a reward merkle tree with each leaf as `(recipient, amount, contract_address)`
function genRewardMerkleTree(users: string[], amounts: number[], rewardContract: string): {tree: StandardMerkleTree<any>, amount: bigint} {
    const leafEncoding =  ["address", "uint256", "address"];
    const values: any[][] = users.map((user, index): any[] => [user, amounts[index].toString(), rewardContract]);
    const tree = StandardMerkleTree.of(values, leafEncoding);
    const total: number = amounts.reduce((sum, current) => sum + current, 0);
    return {tree, amount: toBigInt(total)};
}

function getMTreeProof(mtree: StandardMerkleTree<any>, addr: string): {proof: string[], leaf: string} {
    for (const [i, v] of mtree.entries()) {
        if (v[0] === addr) {
            const proof = mtree.getProof(i);
            const leaf = standardLeafHash(["address", "uint256", "address"], v);
            // console.log('-Value:', v);
            // console.log('-Proof:', proof);
            // console.log('-Leaf :', leaf);
            return {proof, leaf};
        }
    }

    return {proof: [], leaf: ""};
}

function genRewardLeaf(recipient: string, amount: string, thisAddress: string) {
    const encoding =  ["address", "uint256", "address"];
    const encodedLeaf = abiCode.encode(encoding, [recipient, amount, thisAddress]);
    return getBytes(keccak256(encodedLeaf))
}

function genPostRewardMessageHash(rewardRoot: string, rewardAmount: bigint, posterFeeNonce: bigint, contractAddress: string): Uint8Array {
    const encoding = ["bytes32", "uint256", "uint256", "address"];
    const encodedMsg = abiCode.encode(encoding,
        [rewardRoot, rewardAmount, posterFeeNonce, contractAddress]);
    const messageHashBytes = getBytes(keccak256(encodedMsg))
    // const messageHash = keccak256(encodedMsg);
    // expect(messageHash).to.equal(toQuantity(messageHashBytes));

    return messageHashBytes
}

function genUpdatePosterFeeMessageHash(rewardAmount: bigint, nonce: bigint, contractAddress: string): Uint8Array {
    const encoding = ["uint256", "uint256", "address"];
    const encodedMsg = abiCode.encode(encoding,
        [rewardAmount, nonce, contractAddress]);
    return getBytes(keccak256(encodedMsg))
}

function genUpdateSignersMessageHash(signers: string[], threshold: number, rewardContract: string): Uint8Array {
    const encoding = ["address[]", "uint8", "address"];
    const encodedMsg = abiCode.encode(encoding,
        [signers, threshold, rewardContract]);
    return getBytes(keccak256(encodedMsg))
}

// mtjs is a demonstration using merkletreejs to generate OpenZeppelin compatible tree
function mtjs(): string {
    const addr1 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const addr2 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const addr3 = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
    const addr4 = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
    const addr5 = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";
    const contract = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc";

    const l1 = genRewardLeaf(addr1, "100", contract);
    // console.log("----", keccak256(l1))
    const l2 = genRewardLeaf(addr2, "200", contract);
    // console.log("----", keccak256(l2))
    const l3 = genRewardLeaf(addr3, "100", contract);
    // console.log("----", keccak256(l3))

    const leaves = [l1,l2,l3];
    // the OpenZeppelin Standard Merkle Tree uses an opinionated double leaf hashing algorithm
    // and the odd leaf is unchanged and be used for next pairing.
    // So any Go/JS library has similar implementation should be compatible.
    const tree = new MerkleTree(leaves, keccak256, { hashLeaves: true, sortLeaves: true, sortPairs: true})
    // console.log("tree--", tree.toString()) // show the tree structure
    const root = tree.getRoot().toString('hex')
    return root
}

describe("MerkleTree", function () {
    const addr1 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const addr2 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const addr3 = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
    const addr4 = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
    const addr5 = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";
    const contract = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc";

    it("Should generate a merkle tree leaf", async () => {
        const l1 = genRewardLeaf(addr1, "100", contract);
        expect(toQuantity(l1)).to.equal("0x65fef5c01e7c257346e6e8f73387b7629868a2d6b7c33a797bf66221955b1243");

        const l2 = genRewardLeaf(addr2, "200", contract);
        expect(toQuantity(l2)).to.equal("0xeead0f527d6a0b128921e7ba9ffb2cdaa1168bda76cd00e566a706ed5771ac28");

        const l3 = genRewardLeaf(addr3, "100", contract);
        expect(toQuantity(l3)).to.equal("0xfd9ed9c87a7232f483697c9fe33cc9c52f534abfb4290002a58f650b6e360e1b");

        expect(mtjs()).to.equal("e4b867aad8e2ed878496a1d11f020ec3e2cb4470e552bbaeb5d3cb8b633b7d60");
    })

    it("Should generate a merkle tree with 3 leafs", async () => {
        const t = genRewardMerkleTree([addr1, addr2, addr3],
            [100, 200, 100], contract);
        expect(JSON.stringify(t.tree.dump())).to.equal(fs.readFileSync("./test/testdata/3leafs_tree.json").toString());
        expect(t.tree.root).to.equal("0xe4b867aad8e2ed878496a1d11f020ec3e2cb4470e552bbaeb5d3cb8b633b7d60"); // same as mtjs output

        const p = getMTreeProof(t.tree, addr3)
        expect(p.proof).to.deep.equal(['0x2f87038f22c4d34c3b4a790a5feeabe33502a6ce9db946d119e9f02ee2c616f9']);
        expect(p.leaf).to.equal('0xe8e4b2dfdc4cd3b98cb2b8a0562554fb20fa55b0a56051a4477a32317de956eb');
    });
    it("Should generate a merkle tree with 4 leafs", async () => {
        const t = genRewardMerkleTree([addr1, addr2, addr3, addr4],
            [100, 200, 100, 200], contract);
        expect(JSON.stringify(t.tree.dump())).to.equal(fs.readFileSync("./test/testdata/4leafs_tree.json").toString());

        const p = getMTreeProof(t.tree, addr3)
        expect(p.proof).to.deep.equal([
            '0x843c5da35b6dec0d96b1667418b89fb8650c0c011fe4622b1304b55bfe1b5d9d',
            '0x195aca1e2ee1f09f900f6174cb3ea54d325f29ad05919a4e4416e1c0558a44d6'
            ]);
        expect(p.leaf).to.equal('0xe8e4b2dfdc4cd3b98cb2b8a0562554fb20fa55b0a56051a4477a32317de956eb');
    });
    it("Should generate a merkle tree with 5 leafs", async () => {
        const t = genRewardMerkleTree([addr1, addr2, addr3, addr4, addr5],
            [100, 200, 100, 200, 100], contract);
        expect(JSON.stringify(t.tree.dump())).to.equal(fs.readFileSync("./test/testdata/5leafs_tree.json").toString());

        const p = getMTreeProof(t.tree, addr3)
        expect(p.proof).to.deep.equal([
            '0x195aca1e2ee1f09f900f6174cb3ea54d325f29ad05919a4e4416e1c0558a44d6',
            '0x038afff99cec2e245a14b191c62ff961b5d4b288634e01b64fd0af40609c0efd'
        ]);
        expect(p.leaf).to.equal('0xe8e4b2dfdc4cd3b98cb2b8a0562554fb20fa55b0a56051a4477a32317de956eb');
    });
})

describe("MessageHash", () => {
    const addr1 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const addr2 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const addr3 = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
    const addr4 = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
    const addr5 = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";
    const contract = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc";
    const root = "0x2b99d11a9a089537b17930650ae00cadce38788df0b095c1e9f350d7088d24bb";

    it("Should have expect post reward message hash", async () => {
        expect(toQuantity(genPostRewardMessageHash(root, toBigInt(100), toBigInt(2), contract)))
            .to.equal("0xc49ce1c0fc2fb8cbdce3bceabff54675091caeda76cdee9ce0a139bd79cd8c02");
    })
    it("Should have expect update poster fee message hash", async () => {
        expect(toQuantity(genUpdatePosterFeeMessageHash(toBigInt(100), toBigInt(2), contract)))
            .to.equal("0x3b8eb0e42096e2ef3e56d9b88604477f25dc2102073f5b4e1967044150d8bec4");
    })
    it("Should have expect update signers message hash", async () => {
        expect(toQuantity(genUpdateSignersMessageHash([addr2, addr3, addr4], 2, contract)))
            .to.equal("0xd2f344153ec2c1720055d2df687b64fa163db8d4d06b8f6ed6f2ab7b03c03339");
    })
});

describe("RewardDistributor", function () {
    // setups
    const emptyRewardRoot = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const rewardContractAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
    const posterFee1 = parseUnits("1000000", "gwei")
    const posterFee2 = parseUnits("2000000", "gwei")

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
            [100,200,100], await rewardDist.getAddress()); // 0x2b99d11a9a089537b17930650ae00cadce38788df0b095c1e9f350d7088d24bb
        const reward = {tree: _firstTree.tree, root: _firstTree.tree.root, amount: _firstTree.amount};

        const posterFeeNonce = await rewardDist.posterFeeNonce();
        const messageHashBytes = genPostRewardMessageHash(reward.root, reward.amount, posterFeeNonce, (await rewardDist.getAddress()));

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
            [100,200,100], await rewardDist.getAddress()); // 0x2b99d11a9a089537b17930650ae00cadce38788df0b095c1e9f350d7088d24bb
        const reward = {tree: _firstTree.tree, root: _firstTree.tree.root, amount: _firstTree.amount};

        const posterFeeNonce = await rewardDist.posterFeeNonce();
        const messageHashBytes = genPostRewardMessageHash(reward.root, reward.amount, posterFeeNonce, (await rewardDist.getAddress()));

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
                [100,200,100], await rewardDist.getAddress()); // 0x2b99d11a9a089537b17930650ae00cadce38788df0b095c1e9f350d7088d24bb
            const reward = {tree: _firstTree.tree, root: _firstTree.tree.root, amount: _firstTree.amount};

            const posterFeeNonce = await rewardDist.posterFeeNonce();
            const messageHashBytes = genPostRewardMessageHash(reward.root, reward.amount, posterFeeNonce, (await rewardDist.getAddress()));

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
                [100,200,100], await rewardDist.getAddress()); // 0x2b99d11a9a089537b17930650ae00cadce38788df0b095c1e9f350d7088d24bb
            // console.log('First Merkle tree:', JSON.stringify(_firstTree.tree.dump()), _firstTree.tree.root);
            const reward = {tree: _firstTree.tree, root: _firstTree.tree.root, amount: _firstTree.amount};

            const posterFeeNonce = await rewardDist.posterFeeNonce();
            const messageHashBytes = genPostRewardMessageHash(reward.root, reward.amount, posterFeeNonce, (await rewardDist.getAddress()));

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
            expect(await rewardDist.postRewardNonce()).to.equal(1);
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
            recipient, amount, reward.root, proof, {value: minEthValue});
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
            recipient, amount, reward.root, proof, {value: minEthValue * toBigInt(2)});

        return {rewardDist, rewardRoot: reward.root, leaf, recipient, rewardClaimer, amount, txResp,
            paid2x: minEthValue*toBigInt(2), claimerOldBalance, posterOldBalance, oldTotalPostedReward,
            recipientOldTokenBalance, contractOldTokenBalance};
    }

    describe("Claim reward", function () {
        it("Should revert if reward root is not posted", async () => {
            const {rewardDist} = await loadFixture(postFirstRewardFixture);

            await expect(rewardDist.connect(rewardClaimer).claimReward(
                user1.address, 100, emptyRewardRoot, [], {value: 10})).to.be.revertedWith("Reward root not posted");
        });

        it("Should revert if reward already claimed", async function(){
            const {rewardDist, rewardRoot, proof, txResp, recipient, amount, paid} = await loadFixture(claimUser1FirstRewardFixture);
            await expect(txResp.wait()).to.emit(rewardDist, "RewardClaimed").withArgs(recipient, amount, rewardClaimer);

            await expect(rewardDist.connect(rewardClaimer).claimReward(
                recipient, amount, rewardRoot, proof, {value: paid})).to.be.revertedWith("Reward already claimed");
        });

        it("Should revert if invalid proof(wrong leaf)", async () => {
            const {rewardDist, reward} = await loadFixture(postFirstRewardFixture);

            const recipient = user1.address;
            const amount = toBigInt(50); // not the same as in leaf
            const {proof, leaf} = getMTreeProof(reward.tree, recipient);
            const minEthValue = await rewardDist.posterFee();

            await expect(rewardDist.connect(rewardClaimer).claimReward(
                user1.address, amount, reward.root, proof, {value: minEthValue})).to.be.revertedWith("Invalid proof");
        });

        it("Should revert if invalid proof(wrong proof)", async () => {
            const {rewardDist, reward} = await loadFixture(postFirstRewardFixture);

            const recipient = user1.address;
            const amount = toBigInt(100);
            const minEthValue = await rewardDist.posterFee();

            await expect(rewardDist.connect(rewardClaimer).claimReward(
                user1.address, amount, reward.root, [], {value: minEthValue})).to.be.revertedWith("Invalid proof");
        })

        it("Should revert if insufficient payment", async () => {
            const {rewardDist, reward} = await loadFixture(postFirstRewardFixture);

            const recipient = user1.address;
            const amount = toBigInt(100);
            const {proof, leaf} = getMTreeProof(reward.tree, recipient);
            const minEthValue = await rewardDist.posterFee();

            await expect(rewardDist.connect(rewardClaimer).claimReward(
                user1.address, amount, reward.root, proof, {value: minEthValue - toBigInt(1000)})).to.be.revertedWith("Insufficient payment for poster");
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

        const nonce = await rewardDist.posterFeeNonce();
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

            const nonce = await rewardDist.posterFeeNonce();
            const rewardAmount = posterFee2;

            const messageHashBytes = genUpdatePosterFeeMessageHash(rewardAmount, nonce + toBigInt(2), await rewardDist.getAddress());

            const signature1 = await signer1.signMessage(messageHashBytes);
            const signature2 = await signer2.signMessage(messageHashBytes);

            await expect(rewardDist.updatePosterFee(rewardAmount, [signature1, signature2]))
                .to.be.revertedWith("Invalid signer");
        });

        it("Should revert if invalid signer(unknown signer)", async () => {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            const nonce = await rewardDist.posterFeeNonce();
            const rewardAmount = posterFee2;

            const messageHashBytes = genUpdatePosterFeeMessageHash(rewardAmount, nonce + toBigInt(2), await rewardDist.getAddress());

            const signature1 = await signer1.signMessage(messageHashBytes);
            const unknownSig = await unknownSigner.signMessage(messageHashBytes);

            await expect(rewardDist.updatePosterFee(rewardAmount, [signature1, unknownSig]))
                .to.be.revertedWith("Invalid signer");
        });

        it("Should succeed", async function(){
            const {rewardDist, fee, nonce, txResp} = await loadFixture(updatePosterFeeFixture);

            expect(txResp).to.emit(rewardDist, "RewardRateUpdated").withArgs(fee, nonce);
            expect(await rewardDist.posterFee()).to.equal(fee);
            expect(await rewardDist.posterFeeNonce()).to.equal(nonce + toBigInt(1));
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
            const messageHashBytes = genUpdateSignersMessageHash(
                newSigners,
                1, // not the same threshold
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
            const messageHashBytes = genUpdateSignersMessageHash(
                newSigners, newThreshold, await rewardDist.getAddress());
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
            const messageHashBytes = genUpdateSignersMessageHash(
                newSigners, newThreshold, await rewardDist.getAddress());
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
            const messageHashBytes = genUpdateSignersMessageHash(
                newSigners, newThreshold, await rewardDist.getAddress());
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
            const messageHashBytes = genUpdateSignersMessageHash(
                newSigners, newThreshold, await rewardDist.getAddress());
            const signatures = [
                await signer1.signMessage(messageHashBytes),
                await signer2.signMessage(messageHashBytes),
            ]

            const txResp = await rewardDist.connect(networkOwner).updateSigners(
                newSigners, newThreshold, signatures);

            expect(txResp).to.emit(rewardDist, "SignersUpdated").withArgs(newSigners, newThreshold);
            expect(await rewardDist.threshold()).to.equal(newThreshold);
            expect(await rewardDist.isSigner(signer1)).to.equal(false);
            expect(await rewardDist.isSigner(signer2)).to.equal(true);
            expect(await rewardDist.isSigner(signer3)).to.equal(true);
            expect(await rewardDist.isSigner(newSigner4)).to.equal(true);


            //
            // expect(await rewardDist.signers(0)).to.equal(signer2);
            // expect(await rewardDist.signers(1)).to.equal(signer3);
            // expect(await rewardDist.signers(2)).to.equal(newSigner4);
        });

        it("Should succeed with less signers", async function() {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            const newSigners = [signer3.address, newSigner4.address];
            const newThreshold = 2;
            const messageHashBytes = genUpdateSignersMessageHash(
                newSigners, newThreshold, await rewardDist.getAddress());
            const signatures = [
                await signer1.signMessage(messageHashBytes),
                await signer2.signMessage(messageHashBytes),
            ]

            const txResp = await rewardDist.connect(networkOwner).updateSigners(
                newSigners, newThreshold, signatures);

            expect(txResp).to.emit(rewardDist, "SignersUpdated").withArgs(newSigners, newThreshold);
            expect(await rewardDist.threshold()).to.equal(newThreshold);
            expect(await rewardDist.isSigner(signer1)).to.equal(false);
            expect(await rewardDist.isSigner(signer3)).to.equal(true);
            expect(await rewardDist.isSigner(newSigner4)).to.equal(true);
            // expect(await rewardDist.signers(0)).to.equal(signer3);
            // expect(await rewardDist.signers(1)).to.equal(newSigner4);

            // await expect(rewardDist.signers(2)).to.be.revertedWithPanic(PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS)
            // await expect(rewardDist.signers(2)).to.revertedWithoutReason();
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
                allAmounts, await rewardDist.getAddress());
            const reward = {tree: _firstTree.tree, root: _firstTree.tree.root, amount: _firstTree.amount};
            const posterFeeNonce = await rewardDist.posterFeeNonce();
            const messageHashBytes = genPostRewardMessageHash(reward.root, reward.amount, posterFeeNonce, (await rewardDist.getAddress()));
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
                recipient, amount, reward.root, proof, {value: minEthValue});
            const claimRewardTxReceipt = await claimRewardTxResp.wait();

            console.log(`Claim reward Fee    `, formatEther(claimRewardTxReceipt.fee),
                ` ether = ${claimRewardTxReceipt.gasUsed} * ${formatUnits(claimRewardTxReceipt.gasPrice, 'gwei')} gwei`);

            // update poster fee
            const nonce = await rewardDist.posterFeeNonce();
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
            const updateSignersMessageHashBytes = genUpdateSignersMessageHash(
                newSigners, newThreshold, await rewardDist.getAddress());
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

    // 0.8.27, hardhat config solidity.optimizer.enabled = false
    //
    // With threshold(also merkle tree leafs) =  20
    // Deploy contract      0.003847104  ether = 3847104 * 1.0 gwei
    // Post reward Fee      0.000316255  ether = 316255 * 1.0 gwei
    // Claim reward Fee     0.000108492  ether = 108492 * 1.0 gwei
    // Update posterFee Fee 0.000224913  ether = 224913 * 1.0 gwei
    // Update signers Fee   0.000332126  ether = 332126 * 1.0 gwei
    //       ✔ threshold 20 (56ms)
    // With threshold(also merkle tree leafs) =  10
    // Deploy contract      0.003390916  ether = 3390916 * 1.0 gwei
    // Post reward Fee      0.00019929  ether = 199290 * 1.0 gwei
    // Claim reward Fee     0.000091392  ether = 91392 * 1.0 gwei
    // Update posterFee Fee 0.00013961  ether = 139610 * 1.0 gwei
    // Update signers Fee   0.000180403  ether = 180403 * 1.0 gwei
    //       ✔ threshold 10
    // With threshold(also merkle tree leafs) =  5
    // Deploy contract      0.003162816  ether = 3162816 * 1.0 gwei
    // Post reward Fee      0.000147989  ether = 147989 * 1.0 gwei
    // Claim reward Fee     0.000089758  ether = 89758 * 1.0 gwei
    // Update posterFee Fee 0.000096902  ether = 96902 * 1.0 gwei
    // Update signers Fee   0.000104464  ether = 104464 * 1.0 gwei
    //       ✔ threshold 5

    // 0.8.27, hardhat config solidity.optimizer.enabled = true
    //
    // With threshold(also merkle tree leafs) =  20
    // Deploy contract      0.0025574  ether = 2557400 * 1.0 gwei
    // Post reward Fee      0.000302978  ether = 302978 * 1.0 gwei
    // Claim reward Fee     0.000105272  ether = 105272 * 1.0 gwei
    // Update posterFee Fee 0.000213056  ether = 213056 * 1.0 gwei
    // Update signers Fee   0.000296208  ether = 296208 * 1.0 gwei
    //       ✔ threshold 20 (47ms)
    // With threshold(also merkle tree leafs) =  10
    // Deploy contract      0.002102522  ether = 2102522 * 1.0 gwei
    // Post reward Fee      0.000191018  ether = 191018 * 1.0 gwei
    // Claim reward Fee     0.000088172  ether = 88172 * 1.0 gwei
    // Update posterFee Fee 0.000133203  ether = 133203 * 1.0 gwei
    // Update signers Fee   0.000162655  ether = 162655 * 1.0 gwei
    //       ✔ threshold 10
    // With threshold(also merkle tree leafs) =  5
    // Deploy contract      0.001875077  ether = 1875077 * 1.0 gwei
    // Post reward Fee      0.000142632  ether = 142632 * 1.0 gwei
    // Claim reward Fee     0.000086654  ether = 86654 * 1.0 gwei
    // Update posterFee Fee 0.00009322  ether = 93220 * 1.0 gwei
    // Update signers Fee   0.000095801  ether = 95801 * 1.0 gwei
    //       ✔ threshold 5
});
