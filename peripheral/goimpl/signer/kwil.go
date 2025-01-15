package signer

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"encoding/base64"
	"fmt"
	"goimpl/utils"

	ethCommon "github.com/ethereum/go-ethereum/common"
	ethCrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/kwilteam/kwil-db/core/client"
	clientTypes "github.com/kwilteam/kwil-db/core/client/types"
	"github.com/kwilteam/kwil-db/core/types"
	"github.com/kwilteam/kwil-db/core/types/decimal"
)

// ConvQueryResultCols convert the idx columns to a type.
// NOTE: this should be provided in SDK.
func ConvQueryResultCols[T any](qr types.QueryResult, idx int) []T {
	cols := make([]T, 0, len(qr.Values))
	for i, row := range qr.Values {
		var col T
		col = row[idx].(T)
		cols[i] = col
	}
	return cols
}

type KwilRewardExtAPI interface {
	SetNs(ns string)
	//FetchPendingRewards(ctx context.Context, startHeight int64, endHeight int64) ([]*PendingReward, error)
	FetchEpochRewards(ctx context.Context, startHeight int64, limit int) ([]*EpochReward, error)
	FetchLatestRewards(ctx context.Context, limit int) ([]*FinalizedReward, error)
	//ProposeEpoch is more reasonable to be called by Kwil network.
	//ProposeEpoch(ctx context.Context, safeNonce int64) (string, error)
	VoteEpoch(ctx context.Context, signHash []byte, signature []byte) (string, error)
}

type kwilApi struct {
	clt *client.Client
	ns  string
}

func NewKwilApi(clt *client.Client, ns string) *kwilApi {
	return &kwilApi{
		clt: clt,
		ns:  ns,
	}
}

func (k *kwilApi) SetNs(ns string) {
	k.ns = ns
}

func (k *kwilApi) FetchPendingRewards(ctx context.Context, startHeight int64, endHeight uint64) ([]*PendingReward, error) {
	procedure := "list_rewards"
	input := []any{startHeight, endHeight}

	res, err := k.clt.Call(ctx, k.ns, procedure, input)
	if err != nil {
		return nil, err
	}

	prs := make([]*PendingReward, len(res.QueryResult.Values))

	for i, v := range res.QueryResult.Values {
		prs[i] = &PendingReward{}

		prs[i].ID, err = types.ParseUUID(v[0].(string))
		if err != nil {
			return nil, err
		}

		prs[i].Recipient = v[1].(string)

		prs[i].Amount, err = decimal.NewFromString(v[2].(string))
		if err != nil {
			return nil, err
		}
		prs[i].CreatedAt = int64(v[3].(float64))

		prs[i].ContractID, err = types.ParseUUID(v[4].(string))
		if err != nil {
			return nil, err
		}
	}

	return prs, nil
}

func (k *kwilApi) FetchEpochRewards(ctx context.Context, startHeight int64, limit int) ([]*EpochReward, error) {
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
		ers[i] = &EpochReward{}
		ers[i].ID, err = types.ParseUUID(v[0].(string))
		if err != nil {
			return nil, err
		}

		ers[i].StartHeight = int64(v[1].(float64))
		ers[i].EndHeight = int64(v[2].(float64))
		ers[i].TotalRewards, err = decimal.NewFromString(v[3].(string))
		if err != nil {
			return nil, err
		}

		//ers[i].MtreeJson = v[4].(string)

		ers[i].RewardRoot, err = base64.StdEncoding.DecodeString(v[4].(string))
		if err != nil {
			return nil, err
		}

		ers[i].SafeNonce = int64(v[5].(float64))

		ers[i].SignHash, err = base64.StdEncoding.DecodeString(v[6].(string))
		if err != nil {
			return nil, err
		}
		fmt.Printf("======signHash==========%x\n", ers[i].SignHash)

		ers[i].ContractID, err = types.ParseUUID(v[7].(string))
		if err != nil {
			return nil, err
		}

		voters := utils.Map(v[8].([]any), func(v any) string { s, _ := v.(string); return s })
		ers[i].Voters = voters
	}

	return ers, nil
}

func (k *kwilApi) FetchLatestRewards(ctx context.Context, limit int) ([]*FinalizedReward, error) {
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
		frs[i] = &FinalizedReward{}
		frs[i].ID, err = types.ParseUUID(v[0].(string))
		if err != nil {
			return nil, err
		}

		frs[i].TotalRewards, err = decimal.NewFromString(v[1].(string))
		if err != nil {
			return nil, err
		}

		frs[i].RewardRoot, err = base64.StdEncoding.DecodeString(v[2].(string))
		if err != nil {
			return nil, err
		}

		frs[i].SignHash, err = base64.StdEncoding.DecodeString(v[4].(string))
		if err != nil {
			return nil, err
		}

		frs[i].EndHeight = int64(v[5].(float64))
		frs[i].CreatedAt = int64(v[6].(float64))

		frs[i].EpochID, err = types.ParseUUID(v[7].(string))
		if err != nil {
			return nil, err
		}
	}

	return frs, nil
}

func (k *kwilApi) ProposeEpoch(ctx context.Context) (string, error) {
	procedure := "propose_epoch"
	input := [][]any{{}}

	res, err := k.clt.Execute(ctx, k.ns, procedure, input, clientTypes.WithSyncBroadcast(true))
	if err != nil {
		return "", err
	}

	fmt.Printf("================%+v\n", res)

	return res.String(), nil
}

func (k *kwilApi) VoteEpoch(ctx context.Context, signHash []byte, signature []byte) (string, error) {
	procedure := "vote_epoch"
	input := [][]any{{signHash, signature}}

	res, err := k.clt.Execute(ctx, k.ns, procedure, input, clientTypes.WithSyncBroadcast(true))
	if err != nil {
		return "", err
	}

	fmt.Printf("================%+v\n", res)

	return res.String(), nil
}

// NOTE: this is copied from erc20-reward-extension/reward/crypto.go
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
