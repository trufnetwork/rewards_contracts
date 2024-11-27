import {keccak256, AbiCoder, toBigInt, getBytes, Interface, BigNumberish} from "ethers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { standardLeafHash } from "@openzeppelin/merkle-tree/dist/hashes";
import {assert} from "chai";

const abiCode = new AbiCoder();

// NOTE: Should we include the Kwil chain ID so we can ensure the root is unique
// across Kwil networks.
const MerkleLeafEncoding = ["address", "uint256", "address", "uint256"];

// generate a reward merkle tree with each leaf as `(recipient, amount, contract_address, kwil_block)`
function genRewardMerkleTree(users: string[], amounts: number[], rewardContract: string, kwilBlock: string): {tree: StandardMerkleTree<any>, amount: bigint} {
    assert(users.length === amounts.length, "users and amounts should have the same length");
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

const RewardContractABI: string[] = [
    "function postReward(bytes32 rewardRoot, uint256 rewardAmount) external",
    "function updatePosterFee(uint256 newFee) external",
    "function rewardPoster(bytes32 root) public view returns (address)",
];

function genPostRewardTxData(root: string, amount: BigNumberish): string {
    // Create contract interface
    const iface = new Interface(RewardContractABI);
    // Encode function data
    return iface.encodeFunctionData('postReward', [root, amount]);
}

function genUpdatePosterFeeTxData(fee: BigNumberish): string {
    // Create contract interface
    const iface = new Interface(RewardContractABI);
    // Encode function data
    return iface.encodeFunctionData('updatePosterFee', [fee]);
}

interface KwilReward {
    root: string;
    amount: string;
    signers: string[];
    signatures: string[];
    blockHeight: number;
    leafCount?: number;
}

export {
    genRewardMerkleTree,
    getMTreeProof,
    genRewardLeaf,
    genPostRewardTxData,
    genUpdatePosterFeeTxData,
    RewardContractABI,
    // types
    KwilReward,
}