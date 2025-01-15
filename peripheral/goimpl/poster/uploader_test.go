package poster

import (
	"context"
	"crypto/ecdsa"
	"flag"
	"fmt"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"goimpl/reward"
	"goimpl/utils"
	"math/big"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var chainID = flag.String("chain-id", "31337", "chain id")
var token = flag.String("token", "0x5FbDB2315678afecb367f032d93F642f64180aa3", "reward token address")
var contract = flag.String("contract", "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", "reward contract address")
var rpc = flag.String("rpc", "http://localhost:8545/", "rpc url for evm blockchain")

type testWallet [2]string       // address, privateKey
var testWallets = []testWallet{ // from Hardhat
	{"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"},
	{"0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"},
	{"0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"},
	{"0x90F79bf6EB2c4f870365E785982E1f101E93b906", "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"},
	{"0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"},
	{"0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba"},
	{"0x976EA74026E726554dB657fA54763abd0C3a0aa9", "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e"},
	{"0x14dC79964da2C08b23698B3D3cc7Ca32193d9955", "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356"},
	{"0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f", "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97"},
	{"0xa0Ee7A142d267C1f36714E4a8F75612F20a79720", "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6"},
	{"0xBcd4042DE499D14e55001CcbB24a551F3b954096", "0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897"},
	{"0x71bE63f3384f5fb98995898A86B02Fb2426c5788", "0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82"},
	{"0xFABB0ac9d68B0B445fB7357272Ff202C5651694a", "0xa267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1"},
	{"0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec", "0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd"},
	{"0xdF3e18d64BC6A983f673Ab319CCaE4f1a57C7097", "0xc526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa"},
	{"0xcd3B766CCDd6AE721141F452C550Ca635964ce71", "0x8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61"},
	{"0x2546BcD3c84621e976D8185a91A922aE77ECEc30", "0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0"},
	{"0xbDA5747bFD65F08deb54cb465eB87D40e51B197E", "0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd"},
	{"0xdD2FD4581271e230360230F9337D5c0430Bf44C0", "0xde9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0"},
	{"0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199", "0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e"},
}

type NonceGetter func() *big.Int

type mockKwilApi struct {
	signers     []testWallet
	users       []testWallet
	amounts     []uint
	contract    string
	block       uint64
	rewardEvery uint64
	nonce       NonceGetter

	trees map[string]string // root => treeJSON
}

func (m *mockKwilApi) FetchRewardRequests(blockHeight uint64, limit int) ([]*KwilRewardRecord, error) {
	if m.block%m.rewardEvery != 0 { // produce a new reward every few blocks
		m.block += 1
		return nil, nil
	}

	signers := make([]*ecdsa.PrivateKey, len(m.signers))

	var err error
	for i, k := range m.signers {
		signers[i], err = crypto.HexToECDSA(k[1][2:])
		if err != nil {
			return nil, err
		}
	}

	var total uint = 0
	amounts := utils.Map(m.amounts, func(a uint) string {
		total += a
		return fmt.Sprintf("%d", a)
	})

	users := utils.Map(m.users, func(k testWallet) string {
		return k[0]
	})

	t, root, err := reward.GenRewardMerkleTree(users, amounts, m.contract, fmt.Sprintf("%d", m.block))
	if err != nil {
		return nil, err
	}

	m.trees[root] = t
	amount := fmt.Sprintf("%d", total)

	// THIS means, the signers will need to know nonce from the contract.
	// And signers even don't need to query the contract, they can just track the
	// nonce locally, as a reward is bound to one nonce.
	hash, err := reward.GenPostRewardMessageHash(root, amount, m.nonce().String(), m.contract)
	if err != nil {
		return nil, err
	}

	sigs := make([][]byte, len(signers))
	for i, signer := range signers {
		sigs[i], err = reward.EthZeppelinSign(hash, signer)
		if err != nil {
			return nil, err
		}
	}

	m.block += 1

	return []*KwilRewardRecord{
		{
			Root:        root,
			Amount:      amount,
			Signatures:  sigs,
			BlockHeight: m.block - 1,
		},
	}, nil
}

func (m *mockKwilApi) GetRewardProof(root, wallet string) ([][]byte, error) {
	tree, ok := m.trees[root]
	if !ok {
		return nil, fmt.Errorf("reward not found")
	}

	proof, _, err := reward.GetMTreeProof(tree, wallet)
	if err != nil {
		return nil, err
	}

	return proof, nil
}

// newCounter creates a nextIdx that counts from 0 .
func newCounter() chan int {
	ch := make(chan int)
	go func() {
		i := 0
		for {
			ch <- i
			i++
		}
	}()

	return ch
}

func NewEmptyState() *State {
	return &State{
		index: make(map[uint64]int),
	}
}

func NewTmpState() *State {
	return &State{
		index: make(map[uint64]int),
		path:  "/tmp/uploadState.json",
	}
}

func TestUploader_hardhat_first_reward(t *testing.T) {
	// NOTE: This test assumes reward token and reward contract has been deployed.

	if *chainID == "" {
		t.Skip("chain id is not configured")
	}

	if *token == "" {
		t.Skip("token is not configured")
	}

	if *contract == "" {
		t.Skip("contract is not configured")
	}

	if *rpc == "" {
		t.Skip("rpc is not configured")
	}

	uploadPK, err := crypto.HexToECDSA(testWallets[5][1][2:])
	require.NoError(t, err)

	//// get nonce
	client, err := ethclient.Dial(*rpc)
	require.NoError(t, err)
	addr := common.HexToAddress(*contract)
	rewardContract, err := reward.NewReward(addr, client)
	require.NoError(t, err)
	getNonce := func() *big.Int {
		nonce, err := rewardContract.Nonce(nil)
		if err != nil {
			t.Fatalf("get nonce err: %s", err)
		}
		return nonce
	}

	api := &mockKwilApi{
		signers:     testWallets[1:4], // need to be the same as deploy_reward.ts
		users:       testWallets[6:9], // need to be the same as deploy_reward.ts
		amounts:     []uint{100, 200, 100},
		contract:    *contract,
		block:       10,
		rewardEvery: 1,
		nonce:       getNonce,
		trees:       make(map[string]string),
	}

	uploader, err := NewEVMUploader(*rpc, *chainID, *contract, api, uploadPK, NewTmpState())
	require.NoError(t, err)

	uploader.repostPostedReward = true

	ctx := context.Background()

	err = uploader.fetchPendingRewards(ctx)
	require.NoError(t, err)

	err = uploader.checkRewardPostingStatus(ctx)
	require.NoError(t, err)

	require.Equal(t, 1, len(uploader.state.Pending))
	assert.Equal(t, uint64(10), uploader.state.Pending[0])

	err = uploader.checkRewardPostingStatus(ctx)
	require.NoError(t, err)
	assert.Equal(t, 0, len(uploader.state.Pending))
}

func TestUploader_hardhat_run(t *testing.T) {
	// NOTE: This test assumes reward token and reward contract has been deployed.

	if testing.Short() {
		t.Skip("short mode")
	}

	if *chainID == "" {
		t.Skip("chain id is not configured")
	}

	if *token == "" {
		t.Skip("token is not configured")
	}

	if *contract == "" {
		t.Skip("contract is not configured")
	}

	if *rpc == "" {
		t.Skip("rpc is not configured")
	}

	uploadPK, err := crypto.HexToECDSA(testWallets[5][1][2:])
	require.NoError(t, err)

	//// get nonce
	client, err := ethclient.Dial(*rpc)
	require.NoError(t, err)
	addr := common.HexToAddress(*contract)
	rewardContract, err := reward.NewReward(addr, client)
	require.NoError(t, err)
	getNonce := func() *big.Int {
		nonce, err := rewardContract.Nonce(nil)
		if err != nil {
			t.Fatalf("get nonce err: %s", err)
		}
		return nonce
	}

	api := &mockKwilApi{
		signers:     testWallets[1:4], // need to be the same as deploy_reward.ts
		users:       testWallets[6:9], // need to be the same as deploy_reward.ts
		amounts:     []uint{100, 200, 100},
		contract:    *contract,
		block:       37,
		rewardEvery: 3,
		nonce:       getNonce,
		trees:       make(map[string]string),
	}

	state := NewTmpState()
	//state, err := LoadStateFromFile("/tmp/uploadState.json")
	require.NoError(t, err)

	// NOTE: config auto mining to every 30s

	uploader, err := NewEVMUploader(*rpc, *chainID, *contract, api, uploadPK, state)
	require.NoError(t, err)

	ctx := context.Background()
	uploader.Start(ctx)

	time.Sleep(time.Minute * 7)
}

func TestEventTopic(t *testing.T) {
	fmt.Println("RewardPosted", RewardPostedTopic.String())
	fmt.Println("RewardClaimed", RewardClaimedTopic.String())
	fmt.Println("PosterFeeUpdated", PosterFeeUpdatedTopic.String())
}
