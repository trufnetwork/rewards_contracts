import { keccak256, AbiCoder, toBigInt, getBytes } from "ethers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { standardLeafHash } from "@openzeppelin/merkle-tree/dist/hashes";

const abiCode = new AbiCoder();

const MerkleLeafEncoding = ["address", "uint256", "address", "uint256"];

// generate a reward merkle tree with each leaf as `(recipient, amount, contract_address, kwil_block)`
function genRewardMerkleTree(users: string[], amounts: number[], rewardContract: string, kwilBlock: string): {tree: StandardMerkleTree<any>, amount: bigint} {
    const values: any[][] = users.map((user, index): any[] => [user, amounts[index].toString(), rewardContract, kwilBlock]);
    const tree = StandardMerkleTree.of(values, MerkleLeafEncoding);
    const total: number = amounts.reduce((sum, current) => sum + current, 0);
    return {tree, amount: toBigInt(total)};
}

function getMTreeProof(mtree: StandardMerkleTree<any>, addr: string): {proof: string[], leaf: string} {
    for (const [i, v] of mtree.entries()) {
        if (v[0] === addr) {
            const proof = mtree.getProof(i);
            const leaf = standardLeafHash(MerkleLeafEncoding, v);
            // console.log('-Value:', v);
            // console.log('-Proof:', proof);
            // console.log('-Leaf :', leaf);
            return {proof, leaf};
        }
    }

    return {proof: [], leaf: ""};
}

function genRewardLeaf(recipient: string, amount: string, thisAddress: string, kwilBlockHeight: string) {
    const encodedLeaf = abiCode.encode(MerkleLeafEncoding, [recipient, amount, thisAddress, kwilBlockHeight]);
    return getBytes(keccak256(encodedLeaf))
}

function genPostRewardMessageHash(rewardRoot: string, rewardAmount: bigint, nonce: bigint, contractAddress: string): Uint8Array {
    const encoding = ["bytes32", "uint256", "uint256", "address"];
    const encodedMsg = abiCode.encode(encoding,
        [rewardRoot, rewardAmount, nonce, contractAddress]);
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

function genUpdateSignersMessageHash(signers: string[], threshold: number, nonce: bigint, rewardContract: string): Uint8Array {
    const encoding = ["address[]", "uint8", "uint256", "address"];
    const encodedMsg = abiCode.encode(encoding,
        [signers, threshold, nonce, rewardContract]);
    return getBytes(keccak256(encodedMsg))
}

export {
    genRewardMerkleTree,
    getMTreeProof,
    genRewardLeaf,
    genPostRewardMessageHash,
    genUpdatePosterFeeMessageHash,
    genUpdateSignersMessageHash
}