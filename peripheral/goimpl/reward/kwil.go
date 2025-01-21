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
	ID         *types.UUID
	Recipient  string
	Amount     *types.Decimal
	ContractID *types.UUID
	CreatedAt  int64
}

type EpochReward struct {
	ID           *types.UUID
	StartHeight  int64
	EndHeight    int64
	TotalRewards *types.Decimal
	//MtreeJson    string
	RewardRoot []byte
	SafeNonce  int64
	SignHash   []byte
	ContractID *types.UUID
	CreatedAt  int64
	Voters     []string
}

type FinalizedReward struct {
	ID         *types.UUID
	Voters     []string
	Signatures [][]byte
	EpochID    *types.UUID
	CreatedAt  int64
	//
	StartHeight  int64
	EndHeight    int64
	TotalRewards *types.Decimal
	RewardRoot   []byte
	SafeNonce    int64
	SignHash     []byte
	ContractID   *types.UUID
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
		//pr := &PendingReward{}
		//err = types.ScanTo(v, &pr.ID, &pr.Recipient, &pr.Amount, &pr.ContractID, &pr.CreatedAt)
		//if err != nil {
		//	return nil, err
		//}
		//prs[i] = pr

		prs[i] = &PendingReward{}

		prs[i].ID, err = types.ParseUUID(v[0].(string))
		if err != nil {
			return nil, err
		}

		prs[i].Recipient = v[1].(string)

		prs[i].Amount, err = types.ParseDecimal(v[2].(string))
		if err != nil {
			return nil, err
		}

		prs[i].ContractID, err = types.ParseUUID(v[3].(string))
		if err != nil {
			return nil, err
		}

		prs[i].CreatedAt = int64(v[4].(float64))
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
		ers[i] = &EpochReward{}
		ers[i].ID, err = types.ParseUUID(v[0].(string))
		if err != nil {
			return nil, err
		}

		ers[i].StartHeight = int64(v[1].(float64))
		ers[i].EndHeight = int64(v[2].(float64))
		ers[i].TotalRewards, err = types.ParseDecimal(v[3].(string))
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

		ers[i].ContractID, err = types.ParseUUID(v[7].(string))
		if err != nil {
			return nil, err
		}

		ers[i].CreatedAt = int64(v[8].(float64))

		voters := Map(v[9].([]any), func(v any) string { s, _ := v.(string); return s })
		ers[i].Voters = voters

		//er := &EpochReward{}
		//err = types.ScanTo(v, &er.ID, &er.StartHeight, &er.EndHeight, &er.TotalRewards,
		//	&er.RewardRoot, &er.SafeNonce, &er.SignHash, &er.ContractID, &er.CreatedAt, &er.Voters)
		//if err != nil {
		//	return nil, err
		//}
		//ers[i] = er
		//
		//fmt.Println("======v===========", v[4])
		//fmt.Println("======v===========", hex.EncodeToString(ers[i].RewardRoot))

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
		frs[i] = &FinalizedReward{}
		frs[i].ID, err = types.ParseUUID(v[0].(string))
		if err != nil {
			return nil, err
		}

		voters := Map(v[1].([]any), func(v any) string { s, _ := v.(string); return s })
		frs[i].Voters = voters

		signatures := Map(v[2].([]any), func(v any) (sig []byte) {
			s, _ := v.(string)
			sig, err = base64.StdEncoding.DecodeString(s)
			if err != nil {
				return nil
			}
			return sig
		})
		if err != nil {
			return nil, fmt.Errorf("decode signature: %w", err)
		}
		frs[i].Signatures = signatures

		frs[i].EpochID, err = types.ParseUUID(v[3].(string))
		if err != nil {
			return nil, err
		}

		frs[i].CreatedAt = int64(v[4].(float64))

		frs[i].StartHeight = int64(v[5].(float64))
		frs[i].EndHeight = int64(v[6].(float64))

		frs[i].TotalRewards, err = types.ParseDecimal(v[7].(string))
		if err != nil {
			return nil, err
		}

		frs[i].RewardRoot, err = base64.StdEncoding.DecodeString(v[8].(string))
		if err != nil {
			return nil, err
		}

		frs[i].SafeNonce = int64(v[9].(float64))

		frs[i].SignHash, err = base64.StdEncoding.DecodeString(v[10].(string))
		if err != nil {
			return nil, err
		}

		frs[i].ContractID, err = types.ParseUUID(v[11].(string))
		if err != nil {
			return nil, err
		}

		//fr := &FinalizedReward{}
		//err = types.ScanTo(v, &fr.ID, &fr.Voters, &fr.Signatures, &fr.EpochID,
		//	&fr.CreatedAt, &fr.StartHeight, &fr.EndHeight, &fr.TotalRewards,
		//	&fr.RewardRoot, &fr.SafeNonce, &fr.SignHash, &fr.ContractID)
		//if err != nil {
		//	return nil, err
		//}
		//frs[i] = fr
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
