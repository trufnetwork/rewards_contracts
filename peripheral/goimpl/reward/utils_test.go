package reward

import (
	"encoding/hex"
	"strings"
	"testing"

	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMessageHash(t *testing.T) {
	//networkOwner := "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
	user1 := "0x976EA74026E726554dB657fA54763abd0C3a0aa9"
	//user2 := "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955"
	//user3 := "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f"
	//user4 := "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720"
	//user5 := "0xBcd4042DE499D14e55001CcbB24a551F3b954096"
	//contract := "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"

	// root hash; NOTE: no 0x prefix
	const root = "2b99d11a9a089537b17930650ae00cadce38788df0b095c1e9f350d7088d24bb"

	t.Run("post reward message hash", func(t *testing.T) {
		h, err := GenPostRewardMessageHash(root, "100")
		require.NoError(t, err)
		assert.Equal(t, "0x17eafda9202e1b589de2df1274011b7c1eb683d612455744f2913e38855c136d", hexutil.Encode(h))
	})

	t.Run("update poster fee message hash", func(t *testing.T) {
		h, err := GenUpdatePosterFeeMessageHash("100", "2")
		require.NoError(t, err)
		assert.Equal(t, "0x7673bcbb3401a7cbae68f81d40eea2cf35afdaf7ecd016ebf3f02857fcc1260a", hexutil.Encode(h))
	})

	t.Run("update signers message hash", func(t *testing.T) {
		b32String := "0x" + strings.Repeat("1", 64)
		h, err := GenClaimRewardMessageHash(user1, "100", b32String, b32String, []string{})
		require.NoError(t, err)
		assert.Equal(t, "0xb2726430f1a76dcff0a29f8ea3af4f54b5cb06e5bf446e0ddefccf06dad367e0", hexutil.Encode(h))
	})
}

func TestZeppelinSignMessage(t *testing.T) {
	pk := "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
	signer, err := crypto.HexToECDSA(pk)
	require.NoError(t, err)

	msg := "sosup"
	expected := "1fc551d4d1f0901b64432dc59f372beb231adfa2021e1fa5a2cc314df7d98f114ff8afa4603ceee05f768532b615807df8ac358b64b318baaeef5237301240771b"

	sig, err := EthZeppelinSign([]byte(msg), signer)
	require.NoError(t, err)
	assert.Equal(t, expected, hex.EncodeToString(sig))
}
