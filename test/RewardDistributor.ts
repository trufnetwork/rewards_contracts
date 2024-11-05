import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { keccak256, AbiCoder, toBigInt, toQuantity, getBytes, parseUnits } from "ethers";
import { zeroAddress } from "ethereumjs-util";
import { IERC20 } from "../typechain-types";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { standardLeafHash } from "@openzeppelin/merkle-tree/dist/hashes";
const { PANIC_CODES } = require("@nomicfoundation/hardhat-chai-matchers/panic");
import fs from "fs";

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

function genRewardMessageHash(rewardRoot: string, rewardAmount: bigint, rootNonce: bigint, contractAddress: string): Uint8Array {
    const encoding = ["bytes32", "uint256", "uint256", "address"];
    const encodedMsg = abiCode.encode(encoding,
        [rewardRoot, rewardAmount, rootNonce, contractAddress]);
    const messageHashBytes = getBytes(keccak256(encodedMsg))
    // const messageHash = keccak256(encodedMsg);
    // expect(messageHash).to.equal(toQuantity(messageHashBytes));

    return messageHashBytes
}

function genUpdateRewardMessageHash(rewardAmount: bigint, nonce: bigint, contractAddress: string): Uint8Array {
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


describe("MerkleTree", function () {
    const addr1 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const addr2 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const addr3 = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
    const addr4 = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
    const addr5 = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";
    const contract = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc";

    it("Should generate a merkle tree with 3 leafs", async () => {
        const t = genRewardMerkleTree([addr1, addr2, addr3],
            [100, 200, 100], contract);
        expect(JSON.stringify(t.tree.dump())).to.equal(fs.readFileSync("./test/testdata/3leafs_tree.json").toString());

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

    it("Should have expect reward message hash", async () => {
        expect(toQuantity(genRewardMessageHash(root, toBigInt(100), toBigInt(2), contract)))
            .to.equal("0xc49ce1c0fc2fb8cbdce3bceabff54675091caeda76cdee9ce0a139bd79cd8c02");
    })
    it("Should have expect update reward message hash", async () => {
        expect(toQuantity(genUpdateRewardMessageHash(toBigInt(100), toBigInt(2), contract)))
            .to.equal("0x3b8eb0e42096e2ef3e56d9b88604477f25dc2102073f5b4e1967044150d8bec4");
    })
    it("Should have expect update signer message hash", async () => {
        expect(toQuantity(genUpdateSignersMessageHash([addr2, addr3, addr4], 2, contract)))
            .to.equal("0xd2f344153ec2c1720055d2df687b64fa163db8d4d06b8f6ed6f2ab7b03c03339");
    })
});

describe("RewardDistributor", function () {
    // setups
    const emptyRewardRoot = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const rewardContractAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
    const posterReward1 = parseUnits("1000000", "gwei")
    const posterReward2 = parseUnits("2000000", "gwei")

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

        // // generate first reward merkle tree
        // const _firstTree = genRewardMerkleTree([user1.address, user2.address, user3.address],
        //     [100,200,100]); // 0x2b99d11a9a089537b17930650ae00cadce38788df0b095c1e9f350d7088d24bb
        // console.log('First Merkle tree:', JSON.stringify(_firstTree.tree.dump()), _firstTree.tree.root);
        // reward1 = {tree: _firstTree.tree, root: _firstTree.tree.root, amount: _firstTree.amount};
        //
        // // generate second reward merkle tree
        // const _secondTree = genRewardMerkleTree([user1.address, user2.address, user3.address],
        //     [200,200,200]); //
        // console.log('Second Merkle tree:', JSON.stringify(_secondTree.tree.dump()), _secondTree.tree.root);
        // reward2 = {tree: _secondTree.tree, root: _secondTree.tree.root, amount: _secondTree.amount};

        const RewardToken = await hre.ethers.getContractFactory("KwilMockToken");
        rewardToken = await RewardToken.connect(networkOwner).deploy(networkOwner);
    });
    
    // ------------

    async function deployRewardContractFixture() {
        const threshold = 2;
        const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");
        const rewardDist = await RewardDist.connect(networkOwner).deploy(
            [signer1, signer2, signer3], threshold, posterReward1, rewardToken);

        return {rewardDist, threshold, posterReward: posterReward1, rewardToken};
    }

    describe("Deployment", function(){
        it("Should revert if not enough signer", async function(){
            const threshold = 4;
            const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");

            await expect(RewardDist.connect(networkOwner).deploy([signer1, signer2, signer3], threshold, posterReward1, rewardToken))
                .to.be.revertedWith("Threshold must be less than or equal to the number of signers");
        });

        it("Should reject if threshold is less than zero", async () => {
            const threshold = -2;
            const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");

            await expect(RewardDist.connect(networkOwner).deploy(
                [signer1, zeroAddress(), signer3], threshold, posterReward1, rewardToken)).to.be.rejected;
        });
        it("Should revert if threshold is zero", async () => {
            const threshold = 0;
            const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");

            await expect(RewardDist.connect(networkOwner).deploy(
                [signer1, zeroAddress(), signer3], threshold, posterReward1, rewardToken)).to.be.revertedWith("Threshold must be greater than 0");
        });

        it("Should revert if invalid signer(empty address)", async function(){
            const threshold = 2;
            const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");

            await expect(RewardDist.connect(networkOwner).deploy(
                [signer1, zeroAddress(), signer3], threshold, posterReward1, rewardToken)).to.be.revertedWith("Invalid signer");
        })

        it("Should revert if invalid signer(duplicate)", async function(){
            const threshold = 2;
            const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");

            await expect(RewardDist.connect(networkOwner).deploy(
                [signer1, signer1, signer3], threshold, posterReward1, rewardToken)).to.be.revertedWith("Duplicate signer");
        })

        it("Should init correctly", async function(){
            const {rewardDist, threshold, posterReward, rewardToken} = await loadFixture(deployRewardContractFixture);

            expect(await rewardDist.token()).changeTokenBalance(rewardToken, rewardDist, 0);


            expect(await rewardDist.posterReward()).to.equal(posterReward);
            expect(await rewardDist.token()).to.equal(rewardToken);
            expect(await rewardDist.threshold()).to.equal(threshold);
            expect(await rewardDist.signers(0)).to.equal(signer1);
            expect(await rewardDist.signers(1)).to.equal(signer2);
            expect(await rewardDist.signers(2)).to.equal(signer3);
        });
    });

    async function deployRewardContractAndFund1000TokenFixture() {
        const {rewardDist, threshold, posterReward, rewardToken} = await loadFixture(deployRewardContractFixture);
        await rewardToken.transfer((await rewardDist.getAddress()), parseUnits("1000", "ether"));
        return {rewardDist, threshold, posterReward, rewardToken};
    }

    // post the very first reward, with total 400 on three users
    async function postFirstRewardFixture() {
        const {rewardDist} = await loadFixture(deployRewardContractAndFund1000TokenFixture);

        const contractOldTokenBalance = await rewardToken.balanceOf(rewardDist)

        // generate first reward merkle tree
        const _firstTree = genRewardMerkleTree([user1.address, user2.address, user3.address],
            [100,200,100], await rewardDist.getAddress()); // 0x2b99d11a9a089537b17930650ae00cadce38788df0b095c1e9f350d7088d24bb
        // console.log('First Merkle tree:', JSON.stringify(_firstTree.tree.dump()), _firstTree.tree.root);
        const reward = {tree: _firstTree.tree, root: _firstTree.tree.root, amount: _firstTree.amount};

        // // generate second reward merkle tree
        // const _secondTree = genRewardMerkleTree([user1.address, user2.address, user3.address],
        //     [200,200,200], await rewardDist.getAddress()); // 0xecc36c69668c76fa0a17a6034e6570ad86c1715cbcb11b2337728ee5732d4be8
        // console.log('Second Merkle tree:', JSON.stringify(_secondTree.tree.dump()), _secondTree.tree.root);
        // reward2 = {tree: _secondTree.tree, root: _secondTree.tree.root, amount: _secondTree.amount};

        const rootNonce = await rewardDist.rootNonce();
        const messageHashBytes = genRewardMessageHash(reward.root, reward.amount, rootNonce, (await rewardDist.getAddress()));

        const signature1 = await signer1.signMessage(messageHashBytes);
        const signature2 = await signer2.signMessage(messageHashBytes);

        const signature3 = await signer3.signMessage(messageHashBytes);
        // const recoveredAddress1 = verifyMessage(messageHashBytes, signature1);
        // const recoveredAddress2 = verifyMessage(messageHashBytes, signature2);
        // const recoveredAddress3 = verifyMessage(messageHashBytes, signature3);
        // console.log("----+", signature1, signer1.address.toLowerCase(), recoveredAddress1.toLowerCase());
        // console.log("----+", signature2, signer2.address.toLowerCase(), recoveredAddress2.toLowerCase());
        // console.log("----+", signature3, signer3.address.toLowerCase(), recoveredAddress3.toLowerCase());
        const txResp =  await rewardDist.connect(rewardPoster).postRewardRoot(
            reward.root,
            reward.amount,
            [signature1, signature2, signature3])

        return {rewardDist, reward, txResp, contractOldTokenBalance};
    }
    
    describe("Post reward", function(){
        it("Should revert if totalAmount less equal than zero", async function(){
            const {rewardDist} = await loadFixture(deployRewardContractAndFund1000TokenFixture);
            await expect(rewardDist.connect(rewardPoster).postRewardRoot(emptyRewardRoot, 0, []))
                .to.be.revertedWith("Total amount must be greater than 0");
        });

        it("Should revert if not enough signer", async function(){
            const {rewardDist} = await loadFixture(deployRewardContractAndFund1000TokenFixture);
            await expect(rewardDist.connect(rewardPoster).postRewardRoot(emptyRewardRoot, 100, ["0x00"]))
                .to.be.revertedWith("Not enough signatures");
        });

        it("Should revert if reward root already posted", async function(){
            const {rewardDist, reward} = await loadFixture(postFirstRewardFixture);
            await expect(rewardDist.connect(rewardPoster).postRewardRoot(reward.root, 100, ["0x00", "0x11"]))
                .to.be.revertedWith("Reward root already posted");
        });

        it("Should revert if reward amount exceeds contract balance", async function(){
            const {rewardDist} = await loadFixture(deployRewardContractAndFund1000TokenFixture);

            const totalRewardBalance = await rewardToken.balanceOf(await rewardDist.getAddress());
            expect(totalRewardBalance).to.equal(parseUnits("1000", "ether"));

            await expect(rewardDist.connect(rewardPoster).postRewardRoot(emptyRewardRoot, parseUnits("1001", "ether"), ["0x00", "0x11"]))
                .to.be.revertedWith("Insufficient contract balance for reward amount");
        });

        it("Should revert if any signature is not signed by allowed signer", async function(){
            const {rewardDist} = await loadFixture(deployRewardContractAndFund1000TokenFixture);

            const _firstTree = genRewardMerkleTree([user1.address, user2.address, user3.address],
                [100,200,100], await rewardDist.getAddress()); // 0x2b99d11a9a089537b17930650ae00cadce38788df0b095c1e9f350d7088d24bb
            const reward = {tree: _firstTree.tree, root: _firstTree.tree.root, amount: _firstTree.amount};

            const rootNonce = await rewardDist.rootNonce();
            const messageHashBytes = genRewardMessageHash(reward.root, reward.amount, rootNonce, (await rewardDist.getAddress()));

            const signature1 = await signer1.signMessage(messageHashBytes);
            const signature2 = await signer2.signMessage(messageHashBytes);

            const signatureUnknown = await unknownSigner.signMessage(messageHashBytes); // not an allowed signer
            await expect(rewardDist.connect(rewardPoster).postRewardRoot(
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

            const rootNonce = await rewardDist.rootNonce();
            const messageHashBytes = genRewardMessageHash(reward.root, reward.amount, rootNonce, (await rewardDist.getAddress()));

            const signature1 = await signer1.signMessage(messageHashBytes);
            const signature2 = await signer2.signMessage(messageHashBytes);

            const signature3 = await signer2.signMessage(messageHashBytes); // signed with signer2 again
            await expect(rewardDist.connect(rewardPoster).postRewardRoot(
                reward.root,
                reward.amount,
                [signature1, signature2, signature3])).to.be.revertedWith("Duplicate signer")
        });

        it("Should succeed", async function(){
            const {rewardDist, reward, txResp, contractOldTokenBalance} = await loadFixture(postFirstRewardFixture);

            expect(txResp)
                .to.emit(rewardDist, "RewardRootPosted")
                .withArgs(reward.root, reward.amount);
            expect(await rewardDist.rewardRoots(reward.root)).to.equal(rewardPoster.address);
            expect(await rewardDist.totalPostedRewards()).to.equal(reward.amount);
            expect(await rewardDist.rootNonce()).to.equal(1);
            expect(await rewardDist.unpostedRewards()).to.equal(contractOldTokenBalance - reward.amount);
        });
    });

    async function claimUser1FirstRewardFixture() {
        const {rewardDist, reward} = await loadFixture(postFirstRewardFixture);

        const claimerOldBalance = await hre.ethers.provider.getBalance(rewardClaimer.address);
        const posterOldBalance = await hre.ethers.provider.getBalance(rewardPoster.address);
        const oldTotalPostedReward = await rewardDist.totalPostedRewards();
        const recipient = user1.address;
        const claimerOldTokenBalance = await rewardToken.balanceOf(rewardClaimer);
        const contractOldTokenBalance = await rewardToken.balanceOf(rewardDist)

        const amount = toBigInt(100); // need to be the same as what's in the tree.
        const {proof, leaf} = getMTreeProof(reward.tree, recipient);
        const minEthValue = await rewardDist.posterReward();
        const txResp = await rewardDist.connect(rewardClaimer).claimReward(
            recipient, amount, reward.root, proof, {value: minEthValue});

        return {rewardDist, rewardRoot: reward.root, proof, leaf, recipient, rewardClaimer, amount, txResp,
            paid: minEthValue, claimerOldBalance, posterOldBalance, oldTotalPostedReward,
            claimerOldTokenBalance: claimerOldTokenBalance, contractOldTokenBalance};
    }

    async function claimUser1FirstRewardPay2xFixture() {
        const {rewardDist, reward} = await loadFixture(postFirstRewardFixture);

        const claimerOldBalance = await hre.ethers.provider.getBalance(rewardClaimer.address);
        const posterOldBalance = await hre.ethers.provider.getBalance(rewardPoster.address);
        const oldTotalPostedReward = await rewardDist.totalPostedRewards();
        const recipient = user1.address;
        const claimerOldTokenBalance = await rewardToken.balanceOf(rewardClaimer);
        const contractOldTokenBalance = await rewardToken.balanceOf(rewardDist)

        const amount = toBigInt(100); // need to be the same as what's in the tree.
        const {proof, leaf} = getMTreeProof(reward.tree, recipient);
        const minEthValue = await rewardDist.posterReward();
        const txResp = await rewardDist.connect(rewardClaimer).claimReward(
            recipient, amount, reward.root, proof, {value: minEthValue * toBigInt(2)});

        return {rewardDist, rewardRoot: reward.root, leaf, recipient, rewardClaimer, amount, txResp,
            paid2x: minEthValue*toBigInt(2), claimerOldBalance, posterOldBalance, oldTotalPostedReward,
            claimerOldTokenBalance: claimerOldTokenBalance, contractOldTokenBalance};
    }

    describe("Claim reward", function () {
        it("Should revert if reward root is not posted", async () => {
            const {rewardDist, reward} = await loadFixture(postFirstRewardFixture);

            await expect(rewardDist.connect(rewardClaimer).claimReward(
                user1.address, 100, emptyRewardRoot, [], {value: 10})).to.be.revertedWith("Reward root not posted");
        });

        it("Should revert if reward already claimed", async function(){
            const {rewardDist, rewardRoot, proof, leaf, recipient, amount, paid} = await loadFixture(claimUser1FirstRewardFixture);

            await expect(rewardDist.connect(rewardClaimer).claimReward(
                recipient, amount, rewardRoot, proof, {value: paid})).to.be.revertedWith("Reward already claimed");
        });

        it("Should revert if invalid proof(wrong leaf)", async () => {
            const {rewardDist, reward} = await loadFixture(postFirstRewardFixture);

            const recipient = user1.address;
            const amount = toBigInt(50); // not the same as in leaf
            const {proof, leaf} = getMTreeProof(reward.tree, recipient);
            const minEthValue = await rewardDist.posterReward();

            await expect(rewardDist.connect(rewardClaimer).claimReward(
                user1.address, amount, reward.root, proof, {value: minEthValue})).to.be.revertedWith("Invalid proof");
        });

        it("Should revert if invalid proof(wrong proof)", async () => {
            const {rewardDist, reward} = await loadFixture(postFirstRewardFixture);

            const recipient = user1.address;
            const amount = toBigInt(100);
            const minEthValue = await rewardDist.posterReward();

            await expect(rewardDist.connect(rewardClaimer).claimReward(
                user1.address, amount, reward.root, [], {value: minEthValue})).to.be.revertedWith("Invalid proof");
        })

        it("Should revert if insufficient payment", async () => {
            const {rewardDist, reward} = await loadFixture(postFirstRewardFixture);

            const recipient = user1.address;
            const amount = toBigInt(100);
            const {proof, leaf} = getMTreeProof(reward.tree, recipient);
            const minEthValue = await rewardDist.posterReward();

            await expect(rewardDist.connect(rewardClaimer).claimReward(
                user1.address, amount, reward.root, proof, {value: minEthValue - toBigInt(1000)})).to.be.revertedWith("Insufficient payment for poster");
        })

        // TODO: revert if transfer/refund failed

        it("Should revert if reward contract has insufficient token", async () => {})

        it("Should succeed", async function(){
            const {rewardDist, rewardRoot, leaf, recipient, rewardClaimer, amount, txResp,
                paid, claimerOldBalance, posterOldBalance, oldTotalPostedReward,
                claimerOldTokenBalance, contractOldTokenBalance} = await loadFixture(claimUser1FirstRewardFixture);
            const txReceipt = await txResp.wait();

            expect(txResp).to.emit(rewardDist, "RewardClaimed").withArgs(recipient, rewardClaimer, amount);
            // @ts-ignore
            expect(await hre.ethers.provider.getBalance(rewardClaimer.address))
                .to.equal(claimerOldBalance - paid - txReceipt.fee);
            expect(await hre.ethers.provider.getBalance(rewardPoster.address))
                .to.equal(posterOldBalance + paid);
            expect(await rewardDist.claimedRewards(rewardRoot, leaf)).to.equal(true);
            expect(await rewardDist.totalPostedRewards()).to.equal(oldTotalPostedReward - amount);
            expect(await rewardToken.balanceOf(rewardClaimer)).to.equal(claimerOldTokenBalance + amount);
            expect(await rewardToken.balanceOf(rewardDist)).to.equal(contractOldTokenBalance - amount);
        })

        it("Should succeed with refund", async function(){
            const {rewardDist, rewardRoot, leaf, recipient, rewardClaimer, amount, txResp,
                paid2x, claimerOldBalance, posterOldBalance, oldTotalPostedReward,
                claimerOldTokenBalance, contractOldTokenBalance} = await loadFixture(claimUser1FirstRewardPay2xFixture);
            const txReceipt = await txResp.wait();

            expect(txResp).to.emit(rewardDist, "RewardClaimed").withArgs(recipient, rewardClaimer, amount);
            // @ts-ignore
            expect(await hre.ethers.provider.getBalance(rewardClaimer.address))
                .to.equal(claimerOldBalance - paid2x/toBigInt(2) - txReceipt.fee);
            expect(await hre.ethers.provider.getBalance(rewardPoster.address))
                .to.equal(posterOldBalance + paid2x/toBigInt(2));
            expect(await rewardDist.claimedRewards(rewardRoot, leaf)).to.equal(true);
            expect(await rewardDist.totalPostedRewards()).to.equal(oldTotalPostedReward - amount);
            expect(await rewardToken.balanceOf(rewardClaimer)).to.equal(claimerOldTokenBalance + amount);
            expect(await rewardToken.balanceOf(rewardDist)).to.equal(contractOldTokenBalance - amount);
        })
    })

    async function updatePosterRewardFixture() {
        const {rewardDist} = await loadFixture(deployRewardContractFixture);

        const nonce = await rewardDist.rewardNonce();
        const rewardAmount = posterReward2;

        const messageHashBytes = genUpdateRewardMessageHash(rewardAmount, nonce, await rewardDist.getAddress());

        const signature1 = await signer1.signMessage(messageHashBytes);
        const signature2 = await signer2.signMessage(messageHashBytes);

        const txResp = await rewardDist.updatePosterReward(
            rewardAmount, [signature1, signature2]);
        return {rewardDist, rewardAmount, nonce, txResp};
    };

    describe("Update poster reward", () => {
        it("Should revert if reward is less equal than 0", async () => {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            await expect(rewardDist.updatePosterReward(0, [])).to.be.revertedWith("Reward must be greater than 0");
        });

        it("Should revert if not enough signature", async () => {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            await expect(rewardDist.updatePosterReward(11, [])).to.be.revertedWith("Not enough signatures");
        });

        it("Should revert if invalid signer(wrong message)", async () => {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            const nonce = await rewardDist.rewardNonce();
            const rewardAmount = posterReward2;

            const messageHashBytes = genUpdateRewardMessageHash(rewardAmount, nonce + toBigInt(2), await rewardDist.getAddress());

            const signature1 = await signer1.signMessage(messageHashBytes);
            const signature2 = await signer2.signMessage(messageHashBytes);

            await expect(rewardDist.updatePosterReward(rewardAmount, [signature1, signature2]))
                .to.be.revertedWith("Invalid signer");
        });

        it("Should revert if invalid signer(unknown signer)", async () => {
            const {rewardDist} = await loadFixture(deployRewardContractFixture);

            const nonce = await rewardDist.rewardNonce();
            const rewardAmount = posterReward2;

            const messageHashBytes = genUpdateRewardMessageHash(rewardAmount, nonce + toBigInt(2), await rewardDist.getAddress());

            const signature1 = await signer1.signMessage(messageHashBytes);
            const unknownSig = await unknownSigner.signMessage(messageHashBytes);

            await expect(rewardDist.updatePosterReward(rewardAmount, [signature1, unknownSig]))
                .to.be.revertedWith("Invalid signer");
        });

        it("Should succeed", async function(){
            const {rewardDist, rewardAmount, nonce, txResp} = await loadFixture(updatePosterRewardFixture);

            expect(txResp).to.emit(rewardDist, "RewardRateUpdated").withArgs(rewardAmount, nonce);
            expect(await rewardDist.posterReward()).to.equal(rewardAmount);
            expect(await rewardDist.rewardNonce()).to.equal(nonce + toBigInt(1));
        });
    });

    describe("Update signers", function() {
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
            expect(await rewardDist.signers(0)).to.equal(signer2);
            expect(await rewardDist.signers(1)).to.equal(signer3);
            expect(await rewardDist.signers(2)).to.equal(newSigner4);
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
            expect(await rewardDist.signers(0)).to.equal(signer3);
            expect(await rewardDist.signers(1)).to.equal(newSigner4);

            // await expect(rewardDist.signers(2)).to.be.revertedWithPanic(PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS)
            await expect(rewardDist.signers(2)).to.revertedWithoutReason();
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
});