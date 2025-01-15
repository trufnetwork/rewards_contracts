package signer

import (
	"context"
	"crypto/ecdsa"
	"encoding/hex"
	"log/slog"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/kwilteam/kwil-db/core/types"
	"github.com/kwilteam/kwil-db/core/types/decimal"
)

type PendingReward struct {
	ID         *types.UUID
	Recipient  string
	Amount     *decimal.Decimal
	CreatedAt  int64
	ContractID *types.UUID
}

type EpochReward struct {
	ID           *types.UUID
	StartHeight  int64
	EndHeight    int64
	TotalRewards *decimal.Decimal
	//MtreeJson    string
	RewardRoot []byte
	SafeNonce  int64
	SignHash   []byte
	ContractID *types.UUID
	Voters     []string
}

type FinalizedReward struct {
	ID           *types.UUID
	TotalRewards *decimal.Decimal
	RewardRoot   []byte
	Signatures   [][]byte
	SignHash     []byte
	EndHeight    int64
	CreatedAt    int64
	EpochID      *types.UUID
}

type App struct {
	kwil           KwilRewardExtAPI
	ns             string
	pkStr          string
	pk             *ecdsa.PrivateKey
	lastSeenHeight int64
	logger         *slog.Logger
	every          time.Duration

	state *State
}

// NewApp returns a new signer app.
// If syncFrom=0, it will try sync after the latest finalized reward.
func NewApp(api KwilRewardExtAPI, ns string, syncFrom int64, pkStr string, everyS int, state *State) (*App, error) {
	api.SetNs(ns)

	logger := slog.Default()

	privateKey, err := crypto.HexToECDSA(pkStr)
	if err != nil {
		return nil, err
	}

	if syncFrom == 0 { // try
		frs, err := api.FetchLatestRewards(context.Background(), 1)
		if err != nil {
			return nil, err
		}

		if len(frs) == 1 {
			syncFrom = frs[0].EndHeight
			logger.Info("sync from latest finalized reward", "height", syncFrom)
		} else {
			logger.Info("no finalized reward found, sync from height 0")
		}
	}

	return &App{
		lastSeenHeight: syncFrom,
		kwil:           api,
		ns:             ns,
		pkStr:          pkStr,
		pk:             privateKey,
		state:          state,
		logger:         logger,
		every:          time.Duration(everyS) * time.Second,
	}, nil
}

// Verify verifies if the reward root is correct
func (s *App) Verify(ctx context.Context, reward *EpochReward) error {
	// TODO
	s.logger.Info("TODO: verify reward", "reward", reward.ID.String(), "rewardRoot", hex.EncodeToString(reward.RewardRoot))
	return nil
}

// Vote votes an epoch reward
func (s *App) Vote(ctx context.Context, reward *EpochReward) error {
	// TODO: check if already voted

	sig, err := EthGnosisSignDigest(reward.SignHash, s.pk)
	if err != nil {
		return err
	}

	h, err := s.kwil.VoteEpoch(ctx, reward.SignHash, sig)
	if err != nil {
		return err
	}

	s.lastSeenHeight = reward.EndHeight // update

	s.logger.Info("vote reward", "tx", h, "reward", reward.ID.String(), "signHash", hex.EncodeToString(reward.SignHash))

	return s.state.VoteReward(reward.EndHeight, reward.SignHash, h)
}

func (s *App) Sync(ctx context.Context) {
	s.logger.Info("sync started")

	tick := time.NewTicker(s.every)

	for {
		s.logger.Debug("syncing", "lastSeenHeight", s.lastSeenHeight)
		// fetch next batch rewards to be voted, and vote them.
		brs, err := s.kwil.FetchEpochRewards(ctx, s.lastSeenHeight+1, 1)
		if err != nil {
			s.logger.Error("fetch batch reward", "error", err.Error())
		}

		if len(brs) == 0 {
			s.logger.Debug("no batch reward found")
		}

		for _, br := range brs {
			// maybe use the metadata of the extension to skip some vote
			//if len(br.Voters) > 3 {
			//	s.logger.Debug("skip  reward", "reward", br.ID.String(), "rewardHeight", br.EndHeight, "voters", br.Voters)
			//	continue
			//}

			err = s.Verify(ctx, br)
			if err != nil {
				s.logger.Error("verify reward", "reward", br.ID.String(), "rewardHeight", br.EndHeight, "error", err.Error())
				continue // or should break?
			}

			err = s.Vote(ctx, br)
			if err != nil {
				s.logger.Error("vote reward", "reward", br.ID.String(), "rewardHeight", br.EndHeight, "error", err.Error())
			}
		}

		select {
		case <-ctx.Done():
			s.logger.Info("sync stopped")
			return
		case <-tick.C:
			continue
		}
	}
}
