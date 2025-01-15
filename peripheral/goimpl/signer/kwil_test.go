package signer

import (
	"context"
	"crypto/ecdsa"
	"encoding/hex"
	"fmt"
	"testing"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/kwilteam/kwil-db/core/client"
	clientTypes "github.com/kwilteam/kwil-db/core/client/types"
	crypto2 "github.com/kwilteam/kwil-db/core/crypto"
	"github.com/kwilteam/kwil-db/core/crypto/auth"
	"github.com/spf13/pflag"
	"github.com/stretchr/testify/require"
)

var testPK = pflag.String("pk", "", "eth private key")

func getTestSignerOpts(t *testing.T) *clientTypes.Options {
	t.Helper()

	pkBytes, err := hex.DecodeString(*testPK)
	require.NoError(t, err)

	key, err := crypto2.UnmarshalSecp256k1PrivateKey(pkBytes)
	require.NoError(t, err)

	opts := clientTypes.Options{Signer: &auth.EthPersonalSigner{Key: *key}}

	return &opts
}

func getTestPK(t *testing.T) *ecdsa.PrivateKey {
	t.Helper()

	privateKey, err := crypto.HexToECDSA(*testPK)
	require.NoError(t, err)

	return privateKey
}

func Test_issue_reward(t *testing.T) {
	ctx := context.Background()
	opts := getTestSignerOpts(t)

	clt, err := client.NewClient(ctx, "http://localhost:8484", opts)
	require.NoError(t, err)

	procedure := "issue_reward"

	res, err := clt.Execute(ctx, "mydb", procedure, nil)
	require.NoError(t, err)

	fmt.Printf("issue_reward================%+v\n", res.String())
}

func Test_kwilApi_FetchPendingRewards(t *testing.T) {
	ctx := context.Background()

	clt, err := client.NewClient(ctx, "http://localhost:8484", nil)
	require.NoError(t, err)

	k := NewKwilApi(clt, "y_rewards")

	got, err := k.FetchPendingRewards(ctx, 0, 10000)
	require.NoError(t, err)

	for _, r := range got {
		fmt.Println(r)
	}
}

func Test_kwilApi_FetchEpochRewards(t *testing.T) {
	ctx := context.Background()

	clt, err := client.NewClient(ctx, "http://localhost:8484", nil)
	require.NoError(t, err)

	k := NewKwilApi(clt, "y_rewards")

	got, err := k.FetchEpochRewards(ctx, 0, 10)
	require.NoError(t, err)

	for _, r := range got {
		fmt.Println(r)
	}
}

func Test_kwilApi_FetchLatestFinalizedReward(t *testing.T) {
	ctx := context.Background()

	clt, err := client.NewClient(ctx, "http://localhost:8484", nil)
	require.NoError(t, err)

	k := NewKwilApi(clt, "y_rewards")

	got, err := k.FetchLatestRewards(ctx, 10)
	require.NoError(t, err)

	for _, r := range got {
		fmt.Println(r)
	}
}

func Test_kwilApi_ProposeEpoch(t *testing.T) {
	ctx := context.Background()
	opts := getTestSignerOpts(t)
	clt, err := client.NewClient(ctx, "http://localhost:8484", opts)
	require.NoError(t, err)

	k := NewKwilApi(clt, "y_rewards")

	h, err := k.ProposeEpoch(ctx)
	require.NoError(t, err)

	fmt.Println(h)
}

func Test_kwilApi_VoteEpoch(t *testing.T) {
	ctx := context.Background()
	opts := getTestSignerOpts(t)
	pk := getTestPK(t)

	clt, err := client.NewClient(ctx, "http://localhost:8484", opts)
	require.NoError(t, err)

	k := NewKwilApi(clt, "y_rewards")

	signHashHex := "dd4bf09c5800ab9bd8a461955f33a13970c1dffd0f57e0063c7da5e982cdb9a0"
	signHash, err := hex.DecodeString(signHashHex)
	require.NoError(t, err)

	sig, err := EthGnosisSignDigest(signHash, pk)
	require.NoError(t, err)

	fmt.Printf("Yaiba.vote.batch.input--------digest:%x, sig:%x\n", signHash, sig)

	//EthGnosisVerify(sig)

	h, err := k.VoteEpoch(ctx, signHash, sig)
	require.NoError(t, err)

	fmt.Println(h)

}
