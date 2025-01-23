package reward

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"encoding/base64"
	"fmt"
	"golang.org/x/exp/slices"

	ethCommon "github.com/ethereum/go-ethereum/common"
	ethCrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/kwilteam/kwil-db/core/client"
	clientTypes "github.com/kwilteam/kwil-db/core/client/types"
	"github.com/kwilteam/kwil-db/core/types"
)

type PendingReward struct {
	ID         types.UUID
	Recipient  string
	Amount     types.Decimal
	ContractID types.UUID
	CreatedAt  int64
}

type EpochReward struct {
	ID           types.UUID
	StartHeight  int64
	EndHeight    int64
	TotalRewards types.Decimal
	//MtreeJson    string
	RewardRoot []byte
	SafeNonce  int64
	SignHash   []byte // SignHash is Chain aware, it's from GnosisSafeTx
	ContractID types.UUID
	CreatedAt  int64
	Voters     []string
}

type FinalizedReward struct {
	ID         types.UUID
	Voters     []string
	Signatures [][]byte
	EpochID    types.UUID
	CreatedAt  int64
	//
	StartHeight  int64
	EndHeight    int64
	TotalRewards types.Decimal
	RewardRoot   []byte
	SafeNonce    int64
	SignHash     []byte
	ContractID   types.UUID
}

type KwilRewardExtAPI interface {
	SetNS(ns string)
	FetchEpochRewards(ctx context.Context, afterHeight int64, limit int) ([]*EpochReward, error)
	FetchLatestRewards(ctx context.Context, limit int) ([]*FinalizedReward, error)
	VoteEpoch(ctx context.Context, signHash []byte, signature []byte) (string, error)
}

type KwilApi struct {
	clt *client.Client
	ns  string
}

func NewKwilApi(clt *client.Client, ns string) *KwilApi {
	return &KwilApi{
		clt: clt,
		ns:  ns,
	}
}

func (k *KwilApi) SetNS(ns string) {
	k.ns = ns
}

func (k *KwilApi) SearchPendingRewards(ctx context.Context, startHeight int64, endHeight uint64) ([]*PendingReward, error) {
	procedure := "search_rewards"
	input := []any{startHeight, endHeight}

	res, err := k.clt.Call(ctx, k.ns, procedure, input)
	if err != nil {
		return nil, err
	}

	prs := make([]*PendingReward, len(res.QueryResult.Values))

	for i, v := range res.QueryResult.Values {
		pr := &PendingReward{}
		err = types.ScanTo(v, &pr.ID, &pr.Recipient, &pr.Amount, &pr.ContractID, &pr.CreatedAt)
		if err != nil {
			return nil, err
		}
		prs[i] = pr
	}

	return prs, nil
}

func (k *KwilApi) FetchEpochRewards(ctx context.Context, startHeight int64, limit int) ([]*EpochReward, error) {
	procedure := "list_epochs"
	input := []any{startHeight, limit}

	res, err := k.clt.Call(ctx, k.ns, procedure, input)
	if err != nil {
		return nil, err
	}

	if len(res.QueryResult.Values) == 0 {
		return nil, nil
	}

	ers := make([]*EpochReward, len(res.QueryResult.Values))
	for i, v := range res.QueryResult.Values {
		er := &EpochReward{}
		err = types.ScanTo(v, &er.ID, &er.StartHeight, &er.EndHeight, &er.TotalRewards,
			&er.RewardRoot, &er.SafeNonce, &er.SignHash, &er.ContractID, &er.CreatedAt, &er.Voters)
		if err != nil {
			return nil, err
		}
		ers[i] = er
	}

	return ers, nil
}

func (k *KwilApi) FetchLatestRewards(ctx context.Context, limit int) ([]*FinalizedReward, error) {
	procedure := "latest_finalized"
	input := []any{limit}

	res, err := k.clt.Call(ctx, k.ns, procedure, input)
	if err != nil {
		return nil, err
	}

	if len(res.QueryResult.Values) == 0 {
		return nil, nil
	}

	frs := make([]*FinalizedReward, len(res.QueryResult.Values))
	for i, v := range res.QueryResult.Values {
		fr := &FinalizedReward{}
		err = types.ScanTo(v, &fr.ID, &fr.Voters, &fr.Signatures, &fr.EpochID,
			&fr.CreatedAt, &fr.StartHeight, &fr.EndHeight, &fr.TotalRewards,
			&fr.RewardRoot, &fr.SafeNonce, &fr.SignHash, &fr.ContractID)
		if err != nil {
			return nil, err
		}
		frs[i] = fr
	}

	return frs, nil
}

func (k *KwilApi) ProposeEpoch(ctx context.Context) (string, error) {
	procedure := "propose_epoch"
	input := [][]any{{}}

	res, err := k.clt.Execute(ctx, k.ns, procedure, input, clientTypes.WithSyncBroadcast(true))
	if err != nil {
		return "", err
	}

	return res.String(), nil
}

func (k *KwilApi) VoteEpoch(ctx context.Context, signHash []byte, signature []byte) (string, error) {
	procedure := "vote_epoch"
	input := [][]any{{signHash, signature}}

	res, err := k.clt.Execute(ctx, k.ns, procedure, input, clientTypes.WithSyncBroadcast(true))
	if err != nil {
		return "", err
	}

	return res.String(), nil
}

func (k *KwilApi) GetProof(ctx context.Context, signHash []byte, wallet string) ([][]byte, error) {
	procedure := "get_proof"
	input := []any{signHash, wallet}

	res, err := k.clt.Call(ctx, k.ns, procedure, input)
	if err != nil {
		return nil, err
	}

	if len(res.QueryResult.Values) == 0 {
		return nil, nil
	}

	proofs := make([][]byte, len(res.QueryResult.Values))
	for _, v := range res.QueryResult.Values {
		ps := v[0].([]any)
		for i, p := range ps {
			proofs[i], err = base64.StdEncoding.DecodeString(p.(string))
			if err != nil {
				return nil, err
			}
		}
	}
	return proofs, nil
}

// NOTE: this is copied from erc20-reward-extension/reward/crypto.go
// TODO: import instead of copy
func EthGnosisSignDigest(digest []byte, key *ecdsa.PrivateKey) ([]byte, error) {
	sig, err := ethCrypto.Sign(digest, key)
	if err != nil {
		return nil, err
	}

	sig[len(sig)-1] += 27 + 4
	return sig, nil
}

func EthGnosisVerifyDigest(sig []byte, digest []byte, address []byte) error {
	// signature is 65 bytes, [R || S || V] format
	if len(sig) != ethCrypto.SignatureLength {
		return fmt.Errorf("invalid signature length: expected %d, received %d",
			ethCrypto.SignatureLength, len(sig))
	}

	if sig[ethCrypto.RecoveryIDOffset] != 31 && sig[ethCrypto.RecoveryIDOffset] != 32 {
		return fmt.Errorf("invalid signature V")
	}

	sig = slices.Clone(sig)
	sig[ethCrypto.RecoveryIDOffset] -= 31

	pubkeyBytes, err := ethCrypto.Ecrecover(digest, sig)
	if err != nil {
		return fmt.Errorf("invalid signature: recover public key failed: %w", err)
	}

	addr := ethCommon.BytesToAddress(ethCrypto.Keccak256(pubkeyBytes[1:])[12:])
	if !bytes.Equal(addr.Bytes(), address) {
		return fmt.Errorf("invalid signature: expected address %x, received %x", address, addr.Bytes())
	}

	return nil
}
