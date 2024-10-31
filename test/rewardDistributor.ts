import hre from "hardhat";
import {
    time,
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import {BaseContract, Addressable, keccak256, AddressLike, AbiCoder, toBigInt, verifyMessage, getBytes, toQuantity, toUtf8Bytes, formatUnits, parseUnits, Uint8Array} from "ethers";
import {isZeroAddress, zeroAddress} from "ethereumjs-util";
import {IERC20} from "../typechain-types";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import fs from "fs";
import {HexString} from "@openzeppelin/merkle-tree/dist/bytes";
import type {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";


describe("RewardDistributor", function () {

    let networkOwner: HardhatEthersSigner; // kwil network owner, also the owner of the mock reward token
    let signer1: HardhatEthersSigner;
    let signer2: HardhatEthersSigner;
    let signer3: HardhatEthersSigner;
    let newSigner4: HardhatEthersSigner;
    let kwilPoster: HardhatEthersSigner;
    let user1: HardhatEthersSigner;
    let user2: HardhatEthersSigner;
    let user3: HardhatEthersSigner;
    let unknownSigner: HardhatEthersSigner;

    let rewardToken: IERC20;

    const emptyRewardRoot = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const abiCode = new AbiCoder();


    function genMerkleTree(users: string[],  amounts: number[]): {rewardRoot: string, rewardAmount: bigint} {
        const values: any[][] = users.map((user, index): any[] => [user, amounts[index].toString()]);
        const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
        // console.log('Merkle Root:', tree.root);
        // fs.writeFileSync("tree.json", JSON.stringify(tree.dump()));
        const total: number = amounts.reduce((sum, current) => sum + current, 0);
        return {rewardRoot: tree.root, rewardAmount: toBigInt(total)};
    }

    function genRewardMessageHash(rewardRoot: string, rewardAmount: bigint, rootNonce: bigint, contractAddress: string): Uint8Array {
        const encodedMsg = abiCode.encode(["bytes32","uint256", "uint256", "address"],
            [rewardRoot, rewardAmount, rootNonce, contractAddress]);
        const messageHashBytes = getBytes(keccak256(encodedMsg))
        // const messageHash = keccak256(encodedMsg);
        // expect(messageHash).to.equal(toQuantity(messageHashBytes));

        return messageHashBytes
    }

    before(async function () {
        [networkOwner, signer1, signer2, signer3, newSigner4, kwilPoster, user1, user2, user3, unknownSigner] = await hre.ethers.getSigners();


        const RewardToken = await hre.ethers.getContractFactory("KwilMockToken");
        rewardToken = await RewardToken.deploy(networkOwner);
    });


    async function deployRewardContractFixture() {
        const threshold = 2;
        const posterReward = parseUnits("1000000", "gwei")


        const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");
        const rewardDist = await RewardDist.deploy(
            [signer1, signer2, signer3], threshold, posterReward, rewardToken);

        return {rewardDist, threshold, posterReward, rewardToken};
    }

    async function deployRewardContractWithLessSignerFixture() {
        const threshold = 4;
        const posterReward = parseUnits("1000000", "gwei")


        const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");
        const rewardDist = await RewardDist.deploy(
            [signer1, signer2, signer3], threshold, posterReward, rewardToken);

        return {rewardDist, threshold, posterReward, rewardToken};
    }

    async function deployRewardContractWithDuplicateSignerFixture() {
        const threshold = 2;
        const posterReward = parseUnits("1000000", "gwei")


        const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");
        const rewardDist = await RewardDist.deploy(
            [signer1, signer1, signer3], threshold, posterReward, rewardToken);

        return {rewardDist, threshold, posterReward, rewardToken};
    }

    async function deployRewardContractWithEmptySignerFixture() {
        const threshold = 2;
        const posterReward = parseUnits("1000000", "gwei")


        const RewardDist = await hre.ethers.getContractFactory("RewardDistributor");
        const rewardDist = await RewardDist.deploy(
            [signer1, zeroAddress(), signer3], threshold, posterReward, rewardToken);

        return {rewardDist, threshold, posterReward, rewardToken};
    }

    describe("Deployment", function(){
        it("Should revert if not enough signer", async function(){
            await expect(loadFixture(deployRewardContractWithLessSignerFixture)).to.be.revertedWith("Threshold must be less than or equal to the number of signers");
        });

        it("Should revert if empty signer", async function(){
            await expect(loadFixture(deployRewardContractWithEmptySignerFixture)).to.be.revertedWith("Invalid signer");
        })

        it("Should revert if duplicate signer", async function(){
            await expect(loadFixture(deployRewardContractWithDuplicateSignerFixture)).to.be.revertedWith("Duplicate signer");
        })

        it("Should init correctly", async function(){
            const {rewardDist, threshold, posterReward, rewardToken} = await loadFixture(deployRewardContractFixture);
            expect(await rewardDist.threshold()).to.equal(threshold);
            expect(await rewardDist.posterReward()).to.equal(posterReward);
            expect(await rewardDist.token()).to.equal(rewardToken);
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

        const {rewardRoot, rewardAmount} = genMerkleTree([user1.address, user2.address, user3.address],
            [100,200,100]); // 0x3e1a9cb9a569e2be4b10fdc01b75bff2b9e1f440f58f984eac25de6a8791eb8c
        const rootNonce = await rewardDist.rootNonce();
        const messageHashBytes = genRewardMessageHash(rewardRoot, rewardAmount, rootNonce, (await rewardDist.getAddress()));

        const signature1 = await signer1.signMessage(messageHashBytes);
        const signature2 = await signer2.signMessage(messageHashBytes);

        const signature3 = await signer3.signMessage(messageHashBytes);
        // const recoveredAddress1 = verifyMessage(messageHashBytes, signature1);
        // const recoveredAddress2 = verifyMessage(messageHashBytes, signature2);
        // const recoveredAddress3 = verifyMessage(messageHashBytes, signature3);
        // console.log("----+", signature1, signer1.address.toLowerCase(), recoveredAddress1.toLowerCase());
        // console.log("----+", signature2, signer2.address.toLowerCase(), recoveredAddress2.toLowerCase());
        // console.log("----+", signature3, signer3.address.toLowerCase(), recoveredAddress3.toLowerCase());
        const txResp =  await rewardDist.connect(kwilPoster).postRewardRoot(
            rewardRoot,
            rewardAmount,
            [signature1, signature2, signature3])

        return {rewardDist, rewardRoot, totalAmount: rewardAmount, txResp};
    }
    
    describe("Post reward", function(){
        it("Should revert if totalAmount less equal than zero", async function(){
            const {rewardDist} = await loadFixture(deployRewardContractAndFund1000TokenFixture);
            await expect(rewardDist.connect(kwilPoster).postRewardRoot(emptyRewardRoot, 0, []))
                .to.be.revertedWith("Total amount must be greater than 0");
        });

        it("Should revert if not enough signer", async function(){
            const {rewardDist} = await loadFixture(deployRewardContractAndFund1000TokenFixture);
            await expect(rewardDist.connect(kwilPoster).postRewardRoot(emptyRewardRoot, 100, ["0x00"]))
                .to.be.revertedWith("Not enough signatures");
        });

        it("Should revert if reward root already posted", async function(){
            const {rewardDist, rewardRoot} = await loadFixture(postFirstRewardFixture);
            await expect(rewardDist.connect(kwilPoster).postRewardRoot(rewardRoot, 100, ["0x00", "0x11"]))
                .to.be.revertedWith("Reward root already posted");
        });

        it("Should revert if reward amount exceeds contract balance", async function(){
            const {rewardDist} = await loadFixture(deployRewardContractAndFund1000TokenFixture);

            const totalRewardBalance = await rewardToken.balanceOf(await rewardDist.getAddress());
            expect(totalRewardBalance).to.equal(parseUnits("1000", "ether"));

            await expect(rewardDist.connect(kwilPoster).postRewardRoot(emptyRewardRoot, parseUnits("1001", "ether"), ["0x00", "0x11"]))
                .to.be.revertedWith("Reward amount exceeds contract balance");
        });

        it("Should revert if any signature is not signed by allowed signer", async function(){
            const {rewardDist} = await loadFixture(deployRewardContractAndFund1000TokenFixture);

            const {rewardRoot, rewardAmount} = genMerkleTree([user1.address, user2.address, user3.address],
                [100,200,100]); // 0x3e1a9cb9a569e2be4b10fdc01b75bff2b9e1f440f58f984eac25de6a8791eb8c
            const rootNonce = await rewardDist.rootNonce();
            const messageHashBytes = genRewardMessageHash(rewardRoot, rewardAmount, rootNonce, (await rewardDist.getAddress()));

            const signature1 = await signer1.signMessage(messageHashBytes);
            const signature2 = await signer2.signMessage(messageHashBytes);

            const signatureUnknown = await unknownSigner.signMessage(messageHashBytes); // not an allowed signer
            await expect(rewardDist.connect(kwilPoster).postRewardRoot(
                rewardRoot,
                rewardAmount,
                [signature1, signature2, signatureUnknown])).to.be.revertedWith("Invalid signer")
        });

        it("Should revert if any signature comes from same signer", async function(){
            const {rewardDist} = await loadFixture(deployRewardContractAndFund1000TokenFixture);

            const {rewardRoot, rewardAmount} = genMerkleTree([user1.address, user2.address, user3.address],
                [100,200,100]); // 0x3e1a9cb9a569e2be4b10fdc01b75bff2b9e1f440f58f984eac25de6a8791eb8c
            const rootNonce = await rewardDist.rootNonce();
            const messageHashBytes = genRewardMessageHash(rewardRoot, rewardAmount, rootNonce, (await rewardDist.getAddress()));

            const signature1 = await signer1.signMessage(messageHashBytes);
            const signature2 = await signer2.signMessage(messageHashBytes);

            const signature3 = await signer2.signMessage(messageHashBytes); // signed with signer2 again
            await expect(rewardDist.connect(kwilPoster).postRewardRoot(
                rewardRoot,
                rewardAmount,
                [signature1, signature2, signature3])).to.be.revertedWith("Duplicate signer")
        });

        it("Should succeed", async function(){
            const {rewardDist, rewardRoot, totalAmount, txResp} = await loadFixture(postFirstRewardFixture);

            expect(txResp)
                .to.emit(rewardDist, "RewardRootPosted")
                .withArgs(rewardRoot, totalAmount);
            expect(await rewardDist.rewardRoots(rewardRoot)).to.equal(kwilPoster.address);
            expect(await rewardDist.totalPostedRewards()).to.equal(totalAmount);
            expect(await rewardDist.rootNonce()).to.equal(1);
        });
    });

    describe("Claim reward", function () {
        it("Should revert if reward alrewady claimed", async function(){

        });

        it("Should succeed", async function(){
            const receipient = user1.address;
            const amount = toBigInt(50);

        })

    })
});