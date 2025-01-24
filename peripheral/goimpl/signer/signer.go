package main

import (
	"context"
	"crypto/ecdsa"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"log/slog"
	"os"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/kwilteam/kwil-db/core/client"
	clientTypes "github.com/kwilteam/kwil-db/core/client/types"
	kwilCrypto "github.com/kwilteam/kwil-db/core/crypto"
	"github.com/kwilteam/kwil-db/core/crypto/auth"

	"goimpl/reward"
)

type Config struct {
	KwilRPC       string `json:"kwil_rpc,omitempty"`
	PrivateKey    string `json:"private_key,omitempty"`
	KwilNamespace string `json:"kwil_namespace,omitempty"`
	// SyncAfterBlock set the starting block to sync. If not set, will start from the latest.
	SyncAfterBlock int64  `json:"sync_after_block,omitempty"`
	SyncEvery      int    `json:"sync_every,omitempty"` // seconds
	StateFile      string `json:"state_file,omitempty"`
}

type App struct {
	kwil          reward.KwilRewardExtAPI
	pkStr         string
	pk            *ecdsa.PrivateKey
	lastSeenBlock int64
	logger        *slog.Logger
	every         time.Duration

	state *State
}

// NewApp returns a new signer app.
// If syncFrom=0, it will try sync after the latest finalized reward.
func NewApp(api reward.KwilRewardExtAPI, lastBlock int64, pkStr string, everyS int, state *State) (*App, error) {
	logger := slog.Default()

	privateKey, err := crypto.HexToECDSA(pkStr)
	if err != nil {
		return nil, err
	}

	// overwrite parameter lastBlock
	if len(state.data) > 0 {
		lastBlock = state.data[len(state.data)-1].Height
	}

	if lastBlock == 0 { // sync from now
		frs, err := api.FetchLatestRewards(context.Background(), 1)
		if err != nil {
			return nil, fmt.Errorf("fetch latest finalized reward: %w", err)
		}

		if len(frs) == 1 {
			lastBlock = frs[0].EndHeight
			logger.Info("sync from latest finalized reward", "height", lastBlock)
		} else {
			logger.Info("no finalized reward found, sync from height 0")
		}
	} else {
		logger.Info("sync from last seen reward", "height", lastBlock)
	}

	return &App{
		lastSeenBlock: lastBlock,
		kwil:          api,
		pkStr:         pkStr,
		pk:            privateKey,
		state:         state,
		logger:        logger,
		every:         time.Duration(everyS) * time.Second,
	}, nil
}

// Verify verifies if the reward root is correct
func (s *App) Verify(ctx context.Context, reward *reward.EpochReward) error {
	// TODO
	s.logger.Info("TODO: verify reward", "reward", reward.ID.String(), "rewardRoot", hex.EncodeToString(reward.RewardRoot))
	return nil
}

// Vote votes an epoch reward
func (s *App) Vote(ctx context.Context, er *reward.EpochReward) error {
	// TODO: check if already voted

	sig, err := reward.EthGnosisSignDigest(er.SignHash, s.pk)
	if err != nil {
		return err
	}

	h, err := s.kwil.VoteEpoch(ctx, er.SignHash, sig)
	if err != nil {
		return err
	}

	s.lastSeenBlock = er.EndHeight // update

	s.logger.Info("vote reward", "tx", h, "reward", er.ID.String(),
		"signHash", hex.EncodeToString(er.SignHash))

	return s.state.VoteReward(er.EndHeight, er.SignHash, h)
}

func (s *App) Sync(ctx context.Context) {
	s.logger.Info("sync started")

	tick := time.NewTicker(s.every)

	for {
		s.logger.Debug("syncing", "lastSeenBlock", s.lastSeenBlock)
		// fetch next batch rewards to be voted, and vote them.
		brs, err := s.kwil.FetchEpochRewards(ctx, s.lastSeenBlock+1, 1)
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

func main() {
	if len(os.Args) != 2 {
		log.Fatal("Usage: reward-signer <config>")
	}

	configPath := os.Args[1]

	configJSON, err := os.ReadFile(configPath)
	if err != nil {
		log.Fatal(err)
	}

	var cfg Config
	err = json.Unmarshal(configJSON, &cfg)
	if err != nil {
		log.Fatal(err)
	}

	var state *State
	if cfg.StateFile == "" {
		state = NewMemState()
	} else {
		state, err = LoadStateFromFile(cfg.StateFile)
		if err != nil {
			log.Fatal(err)
		}
	}

	pkBytes, err := hex.DecodeString(cfg.PrivateKey)
	if err != nil {
		log.Fatal(err)
	}

	key, err := kwilCrypto.UnmarshalSecp256k1PrivateKey(pkBytes)
	if err != nil {
		log.Fatal(err)
	}

	opts := &clientTypes.Options{Signer: &auth.EthPersonalSigner{Key: *key}}

	ctx := context.Background()
	clt, err := client.NewClient(ctx, cfg.KwilRPC, opts)
	if err != nil {
		log.Fatal(err)
	}

	kwil := reward.NewKwilApi(clt, cfg.KwilNamespace)

	s, err := NewApp(kwil, cfg.SyncAfterBlock, cfg.PrivateKey, cfg.SyncEvery, state)
	if err != nil {
		log.Fatal(err)
	}

	s.Sync(ctx)
}
