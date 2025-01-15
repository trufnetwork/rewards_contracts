import {KwilReward} from "../peripheral/poster/state";
import {
    genRewardMerkleTree,
    getMTreeProof
} from "../peripheral/lib/reward";
import {StandardMerkleTree} from "@openzeppelin/merkle-tree";
import {KwilAPI} from "../peripheral/poster/poster";
import {RewardSafe} from "../peripheral/lib/gnosis";


/**
 * KwilAPITest defines the API for the reward distribution system.
 * It'll be implemented in kwil-db, and used by Poster service and Signer service.
 */
declare class KwilAPITest extends KwilAPI {
    // return merkle tree proof from the tree root and wallet
    getRewardProof(rewardRoot: string, wallet: string): Promise<string[]>
}

/**
 * MockKwilApi is a mock implementation of the KwilAPI interface.
 * It is used to simulate the information for Poster service.
 * It will automatically create Kwil reward upon calling the `fetchRewardRequests`
 * api(with some condition control), and save all related data in memory.
 */
class MockKwilApi implements KwilAPITest {
  signersPK: string[];
  signersAddress: string[];
  usersAddress: string[];
  amounts: number[];
  block: number;
  rewardEvery: number;
  trees: { [root: string]: string }; // root -> tree json

  ethRpc: string;
  safeAddress: string;
  rewardAddress: string;
  safe: RewardSafe;

  constructor(signersPK: string[], signersAddress: string[],
              usersAddress: string[], amounts: number[],
              ethRpc: string, ethChainID: bigint, safeAddress: string, rewardAddress: string,
              block: number, rewardEvery: number) {
    this.signersPK = signersPK;
    this.signersAddress = signersAddress;
    this.usersAddress = usersAddress;
    this.amounts = amounts;
    this.block = block;
    this.rewardEvery = rewardEvery;
    this.trees = {};

    this.ethRpc = ethRpc;
    this.safeAddress = safeAddress;
    this.rewardAddress = rewardAddress;

    this.safe = new RewardSafe(ethRpc, ethChainID, safeAddress, rewardAddress);
  }

  async fetchRewardRequests(blockHeight: number, limit: number): Promise<KwilReward[]> {
    if (this.block % this.rewardEvery !== 0) {
      this.block++;
      return [];
    }

    // const total = this.amounts.reduce((sum, current) => sum + current, 0);
    const {tree, amount} = genRewardMerkleTree(this.usersAddress, this.amounts, this.rewardAddress, this.block.toString());
    this.trees[tree.root] = JSON.stringify(tree.dump());

    let sigs: string[] = [];
    for (let i = 0; i < this.signersPK.length; i++) {
        const {signature} = await this.safe.signPostReward(tree.root, amount.toString(), this.signersPK[i])
        sigs.push(signature);
    }

    this.block++;

    return [
      {
        root: tree.root,
        amount: amount.toString(),
        signers: this.signersAddress,
        signatures: sigs,
        blockHeight: this.block - 1,
      },
    ];
  }

  async getRewardProof(root: string, wallet: string): Promise<string[]> {
    const treeJson = this.trees[root];
    if (!treeJson) {
      return [];
    }

    const tree = StandardMerkleTree.load(JSON.parse(treeJson));

    const proofResult = getMTreeProof(tree, wallet);

    if (!proofResult) {
      return [];
    }

    return proofResult.proof;
  }
}

export {MockKwilApi};