package uploader

import (
	"context"
	"crypto/ecdsa"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/crypto"
	"log"
	"log/slog"
	"math/big"
	"os"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"

	"goimpl/reward"
)

type UploadStatus int

const (
	UploadPending UploadStatus = iota
	UploadPosted
	UploadCommited
)

// State is the database Upload uses.
type State struct {
	// LastBlock is the block height that Uploader has synced with reward.
	LastBlock int64     `json:"last_block"`
	Rewards   []*Reward `json:"rewards"`
	// Posting tracks reward posting process(pending, posted, commited).
	Posting map[int64]int `json:"posting"`

	// index tracks block to index in Rewards
	index map[int64]int

	File string

	mu sync.Mutex
}

// _sync will write State on to disk if it's loaded from disk.
func (s *State) _sync() error {
	if s.File == "" {
		return nil
	}

	f, err := os.OpenFile(s.File, os.O_WRONLY, 0666)
	if err != nil {
		return err
	}
	defer f.Close()

	err = json.NewEncoder(f).Encode(s)
	if err != nil {
		return err
	}

	err = f.Sync()
	if err != nil {
		slog.Error("failed to sync state, restore state", "err", err)
	}

	return err
}

// AddRewardRecord adds a new KwilRewardRecord.
func (s *State) AddRewardRecord(rewards ...*KwilRewardRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, reward := range rewards {
		s.Rewards = append(s.Rewards, &Reward{Request: reward})
		s.index[reward.BlockHeight] = len(s.Rewards) - 1
		s.Posting[reward.BlockHeight] = 0
	}

	return s._sync()
}

func (s *State) UpdateResult(block int64, r *TxResult) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.Rewards[s.index[block]].Result = r

	return s._sync()
}

func NewEmptyState() *State {
	return &State{
		Posting: make(map[int64]int),
		index:   make(map[int64]int),
	}
}

func LoadStateFromFile(stateFile string) (*State, error) {
	s := &State{
		File: stateFile,
	}

	data, err := os.ReadFile(stateFile)
	if err != nil {
		return nil, err
	}

	err = json.Unmarshal(data, s)
	if err != nil {
		return nil, err
	}

	// build index
	for i, r := range s.Rewards {
		s.index[r.Request.BlockHeight] = i
	}

	return s, nil
}

// Reward represents the request and the result of one Kwil reward.
type Reward struct {
	Request *KwilRewardRecord
	Result  *TxResult
}

// KwilRewardRecord is the reward record posted/vetted on Kwil blockchain.
type KwilRewardRecord struct {
	Root        string   `json:"root,omitempty"`
	Amount      string   `json:"amount,omitempty"`
	Signatures  [][]byte `json:"signatures,omitempty"`
	BlockHeight int64    `json:"block_height,omitempty"`
}

// TxResult is the result of posting reward to EVM blockchain.
type TxResult struct {
	Hash         string
	Fee          string
	IncludeBlock int64
}

type Config struct {
	RPC string `json:"rpc,omitempty"`
}

type KwilAPI interface {
	// FetchRewardRequests fetch new reward requests from Kwil blockchain that
	// are newer than block height
	FetchRewardRequests(blockHeight int64) ([]*KwilRewardRecord, error)
	GetRewardProof(rewardRoot string, wallet string) ([][]byte, error)
}

type EVMUploader struct {
	//cfg *Config

	rpc     string `json:"rpc,omitempty"`
	chainID *big.Int

	contract   *reward.Reward
	eth        *ethclient.Client
	kwil       KwilAPI
	signerPk   *ecdsa.PrivateKey
	signerAddr common.Address

	checkInterval time.Duration
	// lastBlock is the block height that uploader processed containing user reward requests.
	lastBlock int64

	mu    sync.Mutex
	state *State
}

// FetchReward calls Kwil API to get new reward requests.
func (u *EVMUploader) fetchReward() {
	slog.Info("fetch reward")

	reqs, err := u.kwil.FetchRewardRequests(u.lastBlock)
	if err != nil {
		slog.Warn("fetch reward failed", "err", err)
		return
	}

	u.mu.Lock()
	defer u.mu.Unlock()

	stateCopy, err := json.Marshal(u.state)
	if err != nil {
		slog.Warn("failed to make copy of state", "err", err)
		return
	}

	err = u.state.AddRewardRecord(reqs...)
	if err != nil {
		slog.Warn("add reward record failed", "err", err)

		if e := json.Unmarshal(stateCopy, u.state); e != nil {
			// fatal
			slog.Error("failed to restore state", "err", err)
		}

		return
	}
}

func (u *EVMUploader) checkPosting() error {
	for block, _ := range u.state.Posting {
		reward := u.state.Rewards[u.state.index[block]]
		if reward.Result == nil { // not posted
			u.postReward(reward)
		}
	}

	return nil
}

// postReward upload a new reward record on to RewardDistributor contract on
// an EVM compatible chain.
func (u *EVMUploader) postReward(reward *Reward) error {
	slog.Info("upload new reward record")

	root, _ := hex.DecodeString(reward.Request.Root)
	amount, _ := new(big.Int).SetString(reward.Request.Amount, 10)

	var b32 [32]byte
	copy(b32[:], root)

	tx, err := u.contract.PostReward(u.getTxAuth(), b32, amount, reward.Request.Signatures)
	if err != nil {
		return err
	}

	fmt.Printf("+%+v\n", tx)

	return nil
}

// FollowTx tracks the Result and ensure it's mined.
// NOTE: There should be some strategy like raise the gas price.
func (u *EVMUploader) FollowTx() error {

	return nil
}

func NewEVMUploader(rpc string, chainId string, rewardAddr string, kwil KwilAPI, pk *ecdsa.PrivateKey, state *State) (*EVMUploader, error) {
	client, err := ethclient.Dial(rpc)
	if err != nil {
		return nil, err
	}

	addr := common.HexToAddress(rewardAddr)

	rewardContract, err := reward.NewReward(addr, client)
	if err != nil {
		return nil, err
	}

	fmt.Printf("---- %+v\n", rewardContract)

	//state, err := LoadStateFromFile(stateFile)
	//if err != nil {
	//	return nil, err
	//}

	publicKey := pk.Public()
	publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
	if !ok {
		log.Fatal("error casting public key to ECDSA")
	}

	fromAddress := crypto.PubkeyToAddress(*publicKeyECDSA)
	cid, _ := new(big.Int).SetString(chainId, 10)

	return &EVMUploader{
		rpc:        rpc,
		chainID:    cid,
		eth:        client,
		contract:   rewardContract,
		kwil:       kwil,
		signerPk:   pk,
		signerAddr: fromAddress,

		state: state,
	}, nil
}

func (u *EVMUploader) getTxAuth() *bind.TransactOpts {
	nonce, err := u.eth.PendingNonceAt(context.Background(), u.signerAddr)
	if err != nil {
		log.Fatal(err)
	}

	gasPrice, err := u.eth.SuggestGasPrice(context.Background())
	if err != nil {
		log.Fatal(err)
	}

	auth, err := bind.NewKeyedTransactorWithChainID(u.signerPk, u.chainID)
	if err != nil {
		log.Fatal(err)
	}

	auth.Nonce = big.NewInt(int64(nonce))
	auth.Value = big.NewInt(0)     // in wei
	auth.GasLimit = uint64(300000) // in units
	auth.GasPrice = gasPrice

	return auth
}

func (u *EVMUploader) Start(ctx context.Context) {
	//go Cron("FetchReward", time.Minute * 5, ctx.Done(), u.FetchReward)

}

// Cron is like linux crontab, runs function fn every interval, and will stop if done.
func Cron(name string, interval time.Duration, done <-chan struct{}, fn func()) {
	ticker := time.NewTicker(interval)
	fn()

	for {
		select {
		case <-ticker.C:
			fn()
		case <-done:
			ticker.Stop()
			slog.Info("cron job " + name + " stopped")
			return
		}
	}
}
