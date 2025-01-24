package reward

import (
	"crypto/ecdsa"

	smt "github.com/FantasyJony/openzeppelin-merkle-tree-go/standard_merkle_tree"
	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/crypto"
)

func GenPostRewardMessageHash(rewardRootHash string, rewardAmount string) ([]byte, error) {
	encoding := []string{"bytes32", "uint256"}
	var b32 [32]byte
	copy(b32[:], smt.SolBytes(rewardRootHash))
	data, err := smt.AbiPack(encoding, b32, smt.SolNumber(rewardAmount))
	if err != nil {
		return nil, err
	}

	//return data, nil
	return smt.Keccak256(data)
}

func GenUpdatePosterFeeMessageHash(newFee string, nonce string) ([]byte, error) {
	encoding := []string{"uint256", "uint256"}
	data, err := smt.AbiPack(encoding, smt.SolNumber(newFee), smt.SolNumber(nonce))
	if err != nil {
		return nil, err
	}
	return smt.Keccak256(data)
}

func GenClaimRewardMessageHash(recipient string, amount string, kwilBlockHash string, rewardRoot string, proofs []string) ([]byte, error) {
	encoding := []string{"address", "uint256", "bytes32", "bytes32", "bytes32[]"}

	var b32KBH [32]byte
	copy(b32KBH[:], smt.SolBytes(kwilBlockHash))

	var b32RR [32]byte
	copy(b32RR[:], smt.SolBytes(rewardRoot))

	data, err := smt.AbiPack(encoding, smt.SolAddress(recipient), smt.SolNumber(amount), b32KBH, b32RR, [][32]byte{})
	if err != nil {
		return nil, err
	}
	return smt.Keccak256(data)
}

// EthZeppelinSign generate a OpenZeppelin compatible signature.
// The produced signature is in the [R || S || V] format where V is 27 or 28.
func EthZeppelinSign(msg []byte, key *ecdsa.PrivateKey) ([]byte, error) {
	sig, err := crypto.Sign(accounts.TextHash(msg), key)
	if err != nil {
		return nil, err
	}

	sig[len(sig)-1] += 27
	return sig, nil
}

// Map turns a []T1 to a []T2 using a mapping function.
func Map[T1, T2 any](s []T1, f func(T1) T2) []T2 {
	r := make([]T2, len(s))
	for i, v := range s {
		r[i] = f(v)
	}
	return r
}

// Reduce reduces a []T1 to a single value using a reduction function.
func Reduce[T1, T2 any](s []T1, initializer T2, f func(T2, T1) T2) T2 {
	r := initializer
	for _, v := range s {
		r = f(r, v)
	}
	return r
}

// Filter filters values from a slice using a filter function.
func Filter[T any](s []T, f func(T) bool) []T {
	var r []T
	for _, v := range s {
		if f(v) {
			r = append(r, v)
		}
	}
	return r
}
