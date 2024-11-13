package uploader

import (
	"context"
	"crypto/ecdsa"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/ethereum/go-ethereum/params"
	"log/slog"
	"math/big"
	"os"
	"slices"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"

	"goimpl/reward"
)

const (
	// fetchKwilRewardBatchLimit is used when request pending rewards from Kwil
	// network, it means at most this number of rewards will be returned
	fetchKwilRewardBatchLimit = 10
	// numOfConfirmation is the number of confirmations to consider a TX is confirmed.
	// NOTE: average Ethereum main net block time is 14s
	numOfConfirmation = 10 // 140s
	// numOfWaitTooLong is the number of blocks that one TX has waited, we
	// should increase the gas price or tip to make this TX get included quicker
	numOfWaitTooLong = 270 // roughly 1 hour
)

var (
	RewardPostedTopic     = crypto.Keccak256Hash([]byte("RewardPosted(bytes32,uint256,address)"))
	RewardClaimedTopic    = crypto.Keccak256Hash([]byte("RewardClaimed(address,uint256,address)"))
	PosterFeeUpdatedTopic = crypto.Keccak256Hash([]byte("PosterFeeUpdated(uint256)"))
	SignersUpdatedTopic   = crypto.Keccak256Hash([]byte("SignersUpdated(address[],uint8)"))
)

// State is the database Uploader uses.
type State struct {
	path string

	mu sync.Mutex
	// LastBlock is the Kwil block height that Uploader has synced with Kwil network.
	LastBlock uint64 `json:"last_block"`
	// Rewards are the reward info.
	// TODO: shrink or backup reward to other files if len(Rewards) to big
	Rewards []*Reward `json:"rewards"`
	// Pending tracks all unconfirmed(pending/posted) Reward, by its Kwil block height.
	// It will be removed after it is confirmed.
	Pending []uint64 `json:"pending"`
	// index tracks block to the index in Rewards
	index map[uint64]int
}

// _sync will write State on to disk if it's loaded from disk.
func (s *State) _sync() error {
	if s.path == "" {
		return nil
	}

	tmpPath := s.path + ".tmp"

	err := os.RemoveAll(tmpPath)
	if err != nil {
		return fmt.Errorf("ensure no tmp file: %w", err)
	}

	tmpFile, err := os.OpenFile(tmpPath, os.O_WRONLY|os.O_CREATE, 0666)
	if err != nil {
		return fmt.Errorf("open file: %w", err)
	}
	defer tmpFile.Close()

	err = json.NewEncoder(tmpFile).Encode(s)
	if err != nil {
		return fmt.Errorf("write state to file: %w", err)
	}

	err = tmpFile.Sync()
	if err != nil {
		return fmt.Errorf("file sync: %w", err)
	}

	err = os.Rename(tmpPath, s.path)
	if err != nil {
		return fmt.Errorf("")
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
		s.Pending = append(s.Pending, reward.BlockHeight)
		s.LastBlock = reward.BlockHeight
	}

	return s._sync()
}

// UpdateResult updates the transaction result.
func (s *State) UpdateResult(block uint64, r *TxInfo) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.Rewards[s.index[block]].Result = r

	if r.IncludeBlock != 0 { // if tx is included, remove it from pending queue
		s.Pending = slices.DeleteFunc(s.Pending, func(b uint64) bool {
			return b == block
		})
	}

	return s._sync()
}

// SkipResult skip current 'pending' reward (since it's already posted).
func (s *State) SkipResult(block uint64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.Pending = slices.DeleteFunc(s.Pending, func(b uint64) bool {
		return b == block
	})

	return s._sync()
}

// LoadStateFromFile load the state from a file.
func LoadStateFromFile(stateFile string) (*State, error) {
	s := &State{
		path:  stateFile,
		index: make(map[uint64]int),
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

// Reward represents the request and the result of posting a Kwil reward.
type Reward struct {
	Request *KwilRewardRecord `json:"request,omitempty"`
	Result  *TxInfo           `json:"result,omitempty"`
}

// KwilRewardRecord is the reward record posted/vetted on Kwil blockchain.
type KwilRewardRecord struct {
	Root       string   `json:"root,omitempty"`
	Amount     string   `json:"amount,omitempty"`
	Signatures [][]byte `json:"signatures,omitempty"`
	// BlockHeight is the block height on Kwil network
	BlockHeight uint64 `json:"block_height,omitempty"`
	// LeafCount is the number of the leafs in this reward Merkle tree.
	// This is useful for Uploader to determine if the reimbursement fee for uploading
	// the reward covers Uploader's tx fee.
	// Since each claim will reimburse Uploader `uploaderFee` amount of eth,
	// if `LeafCount * uploaderFee > uploadTxFee`, Uploader's expense is covered.
	LeafCount uint64 `json:"leaf_count"`
}

// TxInfo is the information of posting reward to EVM blockchain.
type TxInfo struct {
	Hash     common.Hash `json:"hash,omitempty"`
	Fee      *big.Int    `json:"fee,omitempty"`
	GasPrice *big.Int    `json:"gas_price,omitempty"`
	// PostBlock is the block when Tx is posted.
	PostBlock uint64 `json:"post_block"`
	// PostBlock is the block when Tx is included.
	IncludeBlock uint64 `json:"include_block,omitempty"`
	// AccountNonce is the nonce of the account for sending this TX.
	// This will be used to quicken the transaction inclusion by increase the
	// priority fee price.
	AccountNonce uint64 `json:"account_nonce"`
}

func (t TxInfo) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Hash         string `json:"hash,omitempty"`
		Fee          string `json:"fee,omitempty"`
		GasPrice     string `json:"gas_price,omitempty"`
		PostBlock    uint64 `json:"post_block,omitempty"`
		IncludeBlock uint64 `json:"include_block,omitempty"`
		AccountNonce uint64 `json:"account_nonce"`
	}{
		Hash:         t.Hash.String(),
		Fee:          t.Fee.String(),
		GasPrice:     t.GasPrice.String(),
		PostBlock:    t.PostBlock,
		IncludeBlock: t.IncludeBlock,
		AccountNonce: t.AccountNonce,
	})
}

func (t *TxInfo) UnmarshalJSON(data []byte) error {
	var aux struct {
		Hash         string `json:"hash,omitempty"`
		Fee          string `json:"fee,omitempty"`
		GasPrice     string `json:"gas_price,omitempty"`
		PostBlock    uint64 `json:"post_block,omitempty"`
		IncludeBlock uint64 `json:"include_block,omitempty"`
		AccountNonce uint64 `json:"account_nonce"`
	}

	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	fee, ok := new(big.Int).SetString(aux.Fee, 10)
	if !ok {
		return fmt.Errorf("invalid fee: %s", aux.Fee)
	}

	gasPrice, ok := new(big.Int).SetString(aux.GasPrice, 10)
	if !ok {
		return fmt.Errorf("invalid gas price: %s", aux.GasPrice)
	}

	t.Hash = common.HexToHash(aux.Hash)
	t.Fee = fee
	t.GasPrice = gasPrice
	t.PostBlock = aux.PostBlock
	t.IncludeBlock = aux.IncludeBlock
	t.AccountNonce = aux.AccountNonce

	return nil
}

type KwilAPI interface {
	// FetchRewardRequests fetch reward requests from Kwil blockchain that
	// are newer than block height, at most 'limit' number of requests.
	FetchRewardRequests(blockHeight uint64, limit int) ([]*KwilRewardRecord, error)
	GetRewardProof(rewardRoot string, wallet string) ([][]byte, error)
}

type EVMUploader struct {
	rpc          string `json:"rpc,omitempty"`
	chainID      *big.Int
	contractAddr string
	signerPk     *ecdsa.PrivateKey

	contract   *reward.Reward
	eth        *ethclient.Client
	kwil       KwilAPI
	signerAddr common.Address

	// repostPostedReward if true, will skip checking if reward has been posted
	// or not, thus will (potentially) repost posted reward
	// NOTE: This is mostly just for testing.
	repostPostedReward bool

	checkInterval time.Duration
	// lastBlock is the block height that uploader processed containing user reward requests.
	lastBlock uint64

	mu    sync.Mutex
	state *State
}

func (u *EVMUploader) FetchPendingRewards(ctx context.Context) {
	if err := u.fetchPendingRewards(ctx); err != nil {
		slog.Error("fetch pending rewards", "err", err.Error())
	}
}

// fetchPendingRewards calls Kwil API to get new reward requests.
func (u *EVMUploader) fetchPendingRewards(ctx context.Context) error {
	slog.Debug("fetch reward")

	reqs, err := u.kwil.FetchRewardRequests(u.lastBlock, fetchKwilRewardBatchLimit)
	if err != nil {
		//slog.Error("fetch reward failed", "err", err.Error())
		//return
		return fmt.Errorf("fetch reward: %w", err)
	}

	if len(reqs) == 0 {
		slog.Debug("no rew rewards")
		return nil
	}

	err = u.state.AddRewardRecord(reqs...)
	if err != nil {
		//slog.Error("add reward record failed", "err", err)
		return fmt.Errorf("add reward record: %w", err)
	}

	u.lastBlock = reqs[len(reqs)-1].BlockHeight

	if u.repostPostedReward {
		return nil
	}

	// If the reward request has been posed, we skip the tx result for now.
	for _, req := range reqs {
		slog.Info("new reward", "root", req.Root, "kwilBlock", req.BlockHeight)
		root, _ := hex.DecodeString(req.Root)
		var b32 [32]byte
		copy(b32[:], root)
		poster, err := u.contract.RewardPoster(nil, b32)
		if err != nil {
			return fmt.Errorf("get reward poster: %w", err)
		}

		if !IsZeroAddress(poster) { // already posted
			// TODO: populate txResult. need to loop through blocks to search PostReward event,
			// and find correspond TxHash, then populate the result.

			slog.Info("reward is already posted, skip post it",
				"root", req.Root, "kwilBlock", req.BlockHeight)

			err = u.state.SkipResult(req.BlockHeight)
			if err != nil {
				return fmt.Errorf("skip result: %w", err)
			}
		}
	}

	return nil
}

func (u *EVMUploader) CheckRewardPostingStatus(ctx context.Context) {
	if err := u.checkRewardPostingStatus(ctx); err != nil {
		slog.Error("check reward posting status", "err", err.Error())
	}
}

// checkRewardPostingStatus check the status of the first pending reward.
func (u *EVMUploader) checkRewardPostingStatus(ctx context.Context) error {
	if len(u.state.Pending) == 0 {
		slog.Debug("no pending rewards")
		return nil
	}

	block := u.state.Pending[0]
	reward := u.state.Rewards[u.state.index[block]]
	if reward.Result == nil { // not posted
		return u.postReward(ctx, reward, 0, false)
	} else { // posted, yet confirmed
		_, err := u.FollowTx(ctx, reward)
		return err
	}
}

// postReward upload a new reward record on to RewardDistributor contract on
// an EVM compatible chain.
// if prioritize=true, the reward will be re-submitted with previous nonce, normally
// with higher tip.
func (u *EVMUploader) postReward(ctx context.Context, rd *Reward, extraTipInGwei int64, prioritize bool) error {
	slog.Info("post new reward record", "root", rd.Request.Root,
		"kwilBlock", rd.Request.BlockHeight, "prioritize", prioritize,
		"extraTipInGwei", extraTipInGwei)

	root, _ := hex.DecodeString(rd.Request.Root)
	var b32 [32]byte
	copy(b32[:], root)
	amount, ok := new(big.Int).SetString(rd.Request.Amount, 10)
	if !ok {
		return fmt.Errorf("create big int from amount failed")
	}

	currentBlock, err := u.eth.BlockNumber(ctx)
	if err != nil {
		return fmt.Errorf("get current block: %w", err)
	}

	txOpt, err := u.getTxOptions(ctx, extraTipInGwei)
	if err != nil {
		return fmt.Errorf("get tx options: %w", err)
	}

	if prioritize {
		// use previous account nonce, i.e. re-submit transaction
		txOpt.Nonce = big.NewInt(int64(rd.Result.AccountNonce))
	}

	// TODO: set a hard cap here, so we don't lose money.
	//if txOpt.GasFeeCap > {
	//	// too expensive
	//}

	tx, err := u.contract.PostReward(txOpt, b32, amount, rd.Request.Signatures)
	if err != nil {
		return fmt.Errorf("post reward: %w", err)
	}

	slog.Info("post reward", "tx", tx.Hash().String(),
		"root", rd.Request.Root, "block", currentBlock)

	err = u.state.UpdateResult(rd.Request.BlockHeight, &TxInfo{
		Hash:         tx.Hash(),
		Fee:          tx.Cost(),
		GasPrice:     tx.GasPrice(),
		PostBlock:    currentBlock,
		IncludeBlock: 0,
		AccountNonce: txOpt.Nonce.Uint64(),
	})
	if err != nil {
		return fmt.Errorf("update posted rd: %w", err)
	}

	return nil
}

func GetFailingMessageByTXHash(client *ethclient.Client, txHash common.Hash) (string, error) {
	tx, _, err := client.TransactionByHash(context.Background(), txHash)
	if err != nil {
		return "", err
	}

	return GetFailingMessageByTx(client, tx)
}

// GetFailingMessageByTx get the failing/revert message from transaction.
// REF: https://ethereum.stackexchange.com/a/88070
func GetFailingMessageByTx(client *ethclient.Client, tx *types.Transaction) (string, error) {

	from, err := types.Sender(types.NewEIP155Signer(tx.ChainId()), tx)
	if err != nil {
		return "", err
	}

	msg := ethereum.CallMsg{
		From:     from,
		To:       tx.To(),
		Gas:      tx.Gas(),
		GasPrice: tx.GasPrice(),
		Value:    tx.Value(),
		Data:     tx.Data(),
	}

	res, err := client.CallContract(context.Background(), msg, nil)
	if err != nil {
		return "", err
	}

	return string(res), nil
}

// FollowTx tracks the Result and ensure it's mined.
// NOTE: There should be some strategy like raise the gas price.
func (u *EVMUploader) FollowTx(ctx context.Context, rd *Reward) (bool, error) {
	included := false

	tx, pending, err := u.eth.TransactionByHash(ctx, rd.Result.Hash)
	if err != nil {
		return included, fmt.Errorf("get transaction: %w", err)
	}

	currentBlock, err := u.eth.BlockNumber(ctx)
	if err != nil {
		return included, fmt.Errorf("get current block: %w", err)
	}

	if pending {
		if currentBlock-rd.Result.PostBlock > numOfWaitTooLong {
			slog.Info("reward has pending too long, prioritize it",
				"root", rd.Request.Root, "waited", currentBlock-rd.Result.PostBlock)
			return included, u.postReward(ctx, rd, 2, true)
		}

		slog.Info("reward tx still pending", "root", rd.Request.Root,
			"tx", rd.Result.Hash.String(), "waited", currentBlock-rd.Result.PostBlock)
		return included, nil
	}

	// update the tx info after it's included
	receipt, err := u.eth.TransactionReceipt(ctx, rd.Result.Hash)
	if err != nil {
		return included, fmt.Errorf("get transaction receipt: %w", err)
	}

	if receipt.Status == types.ReceiptStatusSuccessful {
		included = true

		if currentBlock-receipt.BlockNumber.Uint64() > numOfConfirmation {
			slog.Info("reward tx has been confirmed", "root", rd.Request.Root,
				"tx", rd.Result.Hash.String(), "block", receipt.BlockNumber.Uint64())
			err = u.state.UpdateResult(rd.Request.BlockHeight, &TxInfo{
				Hash:         rd.Result.Hash,
				Fee:          rd.Result.Fee,
				GasPrice:     rd.Result.GasPrice,
				PostBlock:    rd.Result.PostBlock,
				IncludeBlock: receipt.BlockNumber.Uint64(),
				AccountNonce: rd.Result.AccountNonce,
			})

			if err != nil {
				return included, fmt.Errorf("update finish posting: %w", err)
			}

			return included, nil
		}

		slog.Info("reward tx has been included but yet confirmed", "root", rd.Request.Root,
			"tx", rd.Result.Hash.String(), "block", receipt.BlockNumber.Uint64())
		return included, nil
	}

	// otherwise, tx has failed, need to determine whether we should send another transaction
	msg, err := GetFailingMessageByTx(u.eth, tx)
	if err != nil {
		return included, fmt.Errorf("get revert message: %w", err)
	}

	// TODO
	//switch {
	//case strings.Contains(msg, ""):
	//default:
	//
	//}

	return included, fmt.Errorf("transaction failed: %s", msg)

}

func NewEVMUploader(rpc string, chainId string, rewardAddr string, kwil KwilAPI, pk *ecdsa.PrivateKey, state *State) (*EVMUploader, error) {
	client, err := ethclient.Dial(rpc)
	if err != nil {
		return nil, fmt.Errorf("create eth cliet: %w", err)
	}

	addr := common.HexToAddress(rewardAddr)

	rewardContract, err := reward.NewReward(addr, client)
	if err != nil {
		return nil, fmt.Errorf("create reward contract instance: %w", err)
	}

	publicKey := pk.Public()
	publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("cannot cast type: %T to ECDSA", publicKey)
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

// getTxOptions returns transaction options.
// extraTipGwei is the extra tip per gas on top of the estimated tip; if set,
// the priority fee per gas will increase that amount.
func (u *EVMUploader) getTxOptions(ctx context.Context, extraTipGwei int64) (*bind.TransactOpts, error) {
	nonce, err := u.eth.PendingNonceAt(context.Background(), u.signerAddr)
	if err != nil {
		return nil, fmt.Errorf("get account nonce: %w", err)
	}

	auth, err := bind.NewKeyedTransactorWithChainID(u.signerPk, u.chainID)
	if err != nil {
		return nil, fmt.Errorf("create tx signer: %w", err)
	}

	auth.Nonce = big.NewInt(int64(nonce))
	auth.Value = nil  // in wei, no fund
	auth.GasLimit = 0 // estimate
	// https://www.alchemy.com/blog/eip-1559
	// After EIP-1559, this is not needed;
	auth.GasPrice = nil // NOTE: if GasPrice is set, then GasFeeCap and GasTipCap cannot be set

	tip, err := u.eth.SuggestGasTipCap(ctx)
	if err != nil {
		return nil, fmt.Errorf("estimate gas tip cap: %w", err)
	}

	if extraTipGwei > 0 {
		extraTip := new(big.Int).Mul(big.NewInt(extraTipGwei), big.NewInt(params.GWei))
		auth.GasTipCap = new(big.Int).Add(tip, extraTip)
	}

	return auth, nil
}

func (u *EVMUploader) Start(ctx context.Context) {
	go Cron("FetchPendingRewards", time.Minute*1, ctx, u.FetchPendingRewards)
	time.Sleep(time.Second * 13)
	go Cron("CheckPostingStatus", time.Minute*1, ctx, u.CheckRewardPostingStatus)
}

// Cron is like linux crontab, runs function fn every interval, and will stop
// executing if context is done.
func Cron(name string, interval time.Duration, ctx context.Context, fn func(context.Context)) {
	slog.Info("start new cron job", "name", name, "interval", interval)
	ticker := time.NewTicker(interval)
	fn(ctx)

	for {
		select {
		case <-ticker.C:
			fn(ctx)
		case <-ctx.Done():
			ticker.Stop()
			slog.Info("cron job " + name + " stopped")
			return
		}
	}
}

// IsZeroAddress validate if it's a zero/empty address
func IsZeroAddress(iaddress interface{}) bool {
	var address string
	switch v := iaddress.(type) {
	case string:
		address = v
	case common.Address:
		address = v.String()
	default:
		return false
	}

	return address == "0x0000000000000000000000000000000000000000"

}
