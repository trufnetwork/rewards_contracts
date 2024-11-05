package main

import (
	"fmt"
	smt "github.com/FantasyJony/openzeppelin-merkle-tree-go/standard_merkle_tree"
	"github.com/ethereum/go-ethereum/common"
)

func genRewardMerkleTree(users []string, amounts []string, contractAddress string) (string, error) {
	if len(users) != len(amounts) {
		return "", fmt.Errorf("users and amounts length not equal")
	}

	leafEncoding := []string{smt.SOL_ADDRESS, smt.SOL_UINT256, smt.SOL_ADDRESS}
	values := [][]interface{}{}
	for i, v := range users {
		values = append(values,
			[]interface{}{
				smt.SolAddress(v),
				smt.SolNumber(amounts[i]),
				smt.SolAddress(contractAddress)})
	}

	rewardTree, err := smt.Of(values, leafEncoding)
	if err != nil {
		return "", fmt.Errorf("create reward tree error: %w", err)
	}

	dump, err := rewardTree.TreeMarshal()
	if err != nil {
		return "", fmt.Errorf("reward tree marshal error: %w", err)
	}

	return string(dump), nil
}

func genRewardMessageHash(rewardRootHash string, rewardAmount string, rootNonce string, contractAddress string) ([]byte, error) {
	encoding := []string{"bytes32", "uint256", "uint256", "address"}
	var b32 [32]byte
	copy(b32[:], smt.SolBytes(rewardRootHash))
	data, err := smt.AbiPack(encoding, b32, smt.SolNumber(rewardAmount), smt.SolNumber(rootNonce), common.HexToAddress(contractAddress))
	if err != nil {
		return nil, err
	}

	return smt.Keccak256(data)
}

func genUpdateRewardMessageHash(rewardAmount string, rootNonce string, contractAddress string) ([]byte, error) {
	encoding := []string{"uint256", "uint256", "address"}
	data, err := smt.AbiPack(encoding, smt.SolNumber(rewardAmount), smt.SolNumber(rootNonce), common.HexToAddress(contractAddress))
	if err != nil {
		return nil, err
	}
	return smt.Keccak256(data)
}

func genUpdateSignerMessageHash(signers []string, threshold string, contractAddress string) ([]byte, error) {
	encoding := []string{"address[]", "uint8", "address"}
	signerVs := make([]common.Address, len(signers))
	for i, v := range signers {
		signerVs[i] = common.HexToAddress(v)
	}
	data, err := smt.AbiPack(encoding, signerVs, smt.SolNumber(threshold), common.HexToAddress(contractAddress))
	if err != nil {
		return nil, err
	}
	return smt.Keccak256(data)
}

func getMTreeProof(mtreeJson string, addr string) ([][]byte, []byte, error) {
	t, err := smt.Load([]byte(mtreeJson))
	if err != nil {
		return nil, nil, fmt.Errorf("load mtree error: %w", err)
	}

	entries := t.Entries()
	for k, v := range entries {
		if v.Value[0] == smt.SolAddress(addr) {
			proof, err := t.GetProofWithIndex(k)
			if err != nil {
				return nil, nil, fmt.Errorf("get proof error: %w", err)
			}
			//fmt.Println(fmt.Sprintf("ValueIndex: %v , TreeIndex: %v , Hash: %v ,  Value: %v", v.ValueIndex, v.TreeIndex, hexutil.Encode(v.Hash), v.Value))
			//for pk, pv := range proof {
			//	fmt.Println(fmt.Sprintf("[%v] = %v", pk, hexutil.Encode(pv)))
			//}
			return proof, v.Hash, nil
		}
	}

	return nil, nil, fmt.Errorf("get proof error: %w", err)
}
