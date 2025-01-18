import { expect } from "chai";
import { keccak256, toQuantity } from "ethers";
import fs from "fs";
import {MerkleTree} from "merkletreejs";

import {
    genRewardMerkleTree,
    getMTreeProof,
    genRewardLeaf,
    genPostRewardTxData
} from "../reward";


// mtjs is a demonstration using merkletreejs to generate OpenZeppelin compatible tree
function mtjs(): string {
    const networkOwner = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const user1 = "0x976EA74026E726554dB657fA54763abd0C3a0aa9";
    const user2 = "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955";
    const user3 = "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f";
    const user4 = "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720";
    const contract = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

    const kwilBlock = "100";

    const l1 = genRewardLeaf(user1, "100", contract, kwilBlock);
    const l2 = genRewardLeaf(user2, "200", contract, kwilBlock);
    const l3 = genRewardLeaf(user3, "100", contract, kwilBlock);

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
    // same as hardhat signers
    const networkOwner = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const user1 = "0x976EA74026E726554dB657fA54763abd0C3a0aa9";
    const user2 = "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955";
    const user3 = "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f";
    const user4 = "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720";
    const user5 = "0xBcd4042DE499D14e55001CcbB24a551F3b954096";
    const contract = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

    const kwilBlock = "100";

    it("Should generate a merkle tree leaf", async () => {
        const l1 = genRewardLeaf(user1, "100", contract, kwilBlock);
        expect(toQuantity(l1)).to.equal("0xfcaf84a2840cf86951c64939ace3e3bcf206199fbad1afae669efe1b086e91e3");

        const l2 = genRewardLeaf(user2, "200", contract, kwilBlock);
        expect(toQuantity(l2)).to.equal("0xeeb7f8e08f7782f599b9300241100d4b96d9a07169d66ab06373b7dabd01fb29");

        const l3 = genRewardLeaf(user3, "100", contract, kwilBlock);
        expect(toQuantity(l3)).to.equal("0xe9116681c6189b0ef9636cb903955d5f607ec348783748f6c13d67f6c44e2f0a");


        const t = genRewardMerkleTree([user1, user2, user3],
            [100, 200, 100], contract, kwilBlock);
        expect(t.tree.root).to.equal("0xdac671e71a7196507328c7e5cf5613318112ca9bc20a224771894440f168ac99"); // same as mtjs output
        expect(mtjs()).to.equal("dac671e71a7196507328c7e5cf5613318112ca9bc20a224771894440f168ac99");
    })

    it("Should generate a merkle tree with 3 leafs", async () => {
        const t = genRewardMerkleTree([user1, user2, user3],
            [100, 200, 100], contract, kwilBlock);
        expect(JSON.stringify(t.tree.dump())).to.equal(fs.readFileSync("./test/testdata/3leafs_tree.json").toString());
        expect(t.tree.root).to.equal("0xdac671e71a7196507328c7e5cf5613318112ca9bc20a224771894440f168ac99"); // same as mtjs output

        const p = getMTreeProof(t.tree, user2)
        expect(p.proof).to.deep.equal([
            '0x0fb99d3c8c32262146fa7251931bc2e599fe82a61b8797933dc4c3a91ec73699'
        ]);
        expect(p.leaf).to.equal('0xe3fb0d21d47526461cda4cb34257ce48374133a3f1bcb7c8a974bea234ae0718');
    });
    it("Should generate a merkle tree with 4 leafs", async () => {
        const t = genRewardMerkleTree([user1, user2, user3, user4],
            [100, 200, 100, 200], contract, kwilBlock);
        expect(JSON.stringify(t.tree.dump())).to.equal(fs.readFileSync("./test/testdata/4leafs_tree.json").toString());
        expect(t.tree.root).to.equal("0xd42c83e2df462b5ec237101af747d5b2a7e2db64c3c5b332a191ca2ae6f26331");

        const p = getMTreeProof(t.tree, user2)
        expect(p.proof).to.deep.equal([
            '0x5335f54931b3c05d6bb2a3f700638aed54749d23783a0960788e0a88319c20bd',
            '0x0fb99d3c8c32262146fa7251931bc2e599fe82a61b8797933dc4c3a91ec73699'
        ]);
        expect(p.leaf).to.equal('0xe3fb0d21d47526461cda4cb34257ce48374133a3f1bcb7c8a974bea234ae0718');
    });
    it("Should generate a merkle tree with 5 leafs", async () => {
        const t = genRewardMerkleTree([user1, user2, user3, user4, user5],
            [100, 200, 100, 200, 100], contract, kwilBlock);
        expect(JSON.stringify(t.tree.dump())).to.equal(fs.readFileSync("./test/testdata/5leafs_tree.json").toString());
        expect(t.tree.root).to.equal("0xa4df6caea13914af2c24a75999b7987640542a12fd32524c3e23167212698284");

        const p = getMTreeProof(t.tree, user2)
        expect(p.proof).to.deep.equal([
            '0x0fb99d3c8c32262146fa7251931bc2e599fe82a61b8797933dc4c3a91ec73699',
            '0xf38f00aaa90443ee4735ab771bf54ad4cecf1044934d07d63919c88356eadb27'
        ]);
        expect(p.leaf).to.equal('0xe3fb0d21d47526461cda4cb34257ce48374133a3f1bcb7c8a974bea234ae0718');
    });
})

// Tests for genPostRewardTxData
describe("genPostRewardTxData", () => {
    const root = "0x2b99d11a9a089537b17930650ae00cadce38788df0b095c1e9f350d7088d24bb";
    const functionSelector = "0xeb630dd3";

    it("Should generate correct tx data with number amount", () => {
        const txData = genPostRewardTxData(root, 100);
        // First 4 bytes are function selector for postReward(bytes32,uint256)
        expect(txData.slice(0,10)).to.equal(functionSelector);
        // Remaining data contains encoded root and amount parameters
        expect(txData.length).to.equal(138); // 0x + function selector + 32 bytes root + 32 bytes amount

        expect(txData).to.equal("0xeb630dd32b99d11a9a089537b17930650ae00cadce38788df0b095c1e9f350d7088d24bb0000000000000000000000000000000000000000000000000000000000000064");
    });

    it("Should generate correct tx data with string amount", () => {
        const txData = genPostRewardTxData(root, "200");
        expect(txData.slice(0,10)).to.equal(functionSelector);
        expect(txData.length).to.equal(138); // 0x + function selector + 32 bytes root + 32 bytes amount
        expect(txData).to.equal("0xeb630dd32b99d11a9a089537b17930650ae00cadce38788df0b095c1e9f350d7088d24bb00000000000000000000000000000000000000000000000000000000000000c8");
    });

    it("Should handle large numbers correctly", () => {
        const txData = genPostRewardTxData(root, "1000000000000000000"); // 1 ETH in wei
        expect(txData.slice(0,10)).to.equal(functionSelector);
        expect(txData.length).to.equal(138); // 0x + function selector + 32 bytes root + 32 bytes amount
        expect(txData).to.equal("0xeb630dd32b99d11a9a089537b17930650ae00cadce38788df0b095c1e9f350d7088d24bb0000000000000000000000000000000000000000000000000de0b6b3a7640000");
    });
});
