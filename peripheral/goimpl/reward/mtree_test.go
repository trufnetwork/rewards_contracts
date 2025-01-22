package reward

import (
	"encoding/hex"
	"os"
	"testing"

	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMerkleTree(t *testing.T) {
	//networkOwner := "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
	user1 := "0x976EA74026E726554dB657fA54763abd0C3a0aa9"
	user2 := "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955"
	user3 := "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f"
	user4 := "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720"
	user5 := "0xBcd4042DE499D14e55001CcbB24a551F3b954096"
	contract := "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"

	kwilBlock := "100"

	testdataDir := "../../testdata/"

	t.Run("genMerkleTree with 3 leafs", func(t *testing.T) {
		expectRoot := "dac671e71a7196507328c7e5cf5613318112ca9bc20a224771894440f168ac99"
		mt, root, err := GenRewardMerkleTree([]string{user1, user2, user3}, []string{"100", "200", "100"}, contract, kwilBlock)
		require.NoError(t, err)
		require.Equal(t, expectRoot, root)
		mtFile, err := os.ReadFile(testdataDir + "3leafs_tree.json")
		require.NoError(t, err)
		assert.JSONEq(t, mt, string(mtFile))
		mtProof, mtLeaf, err := GetMTreeProof(mt, user2)
		require.NoError(t, err)
		require.Len(t, mtProof, 1)
		assert.Equal(t, "0x0fb99d3c8c32262146fa7251931bc2e599fe82a61b8797933dc4c3a91ec73699", hexutil.Encode(mtProof[0]))
		assert.Equal(t, "0xe3fb0d21d47526461cda4cb34257ce48374133a3f1bcb7c8a974bea234ae0718", hexutil.Encode(mtLeaf))
	})

	t.Run("genMerkleTree with 4 leafs", func(t *testing.T) {
		expectRoot := "d42c83e2df462b5ec237101af747d5b2a7e2db64c3c5b332a191ca2ae6f26331"
		mt, root, err := GenRewardMerkleTree([]string{user1, user2, user3, user4}, []string{"100", "200", "100", "200"}, contract, kwilBlock)
		require.NoError(t, err)
		require.Equal(t, expectRoot, root)
		mtFile, err := os.ReadFile(testdataDir + "4leafs_tree.json")
		require.NoError(t, err)
		assert.JSONEq(t, mt, string(mtFile))
		mtProof, mtLeaf, err := GetMTreeProof(mt, user2)
		require.NoError(t, err)
		require.Len(t, mtProof, 2)
		assert.Equal(t, "0x5335f54931b3c05d6bb2a3f700638aed54749d23783a0960788e0a88319c20bd", hexutil.Encode(mtProof[0]))
		assert.Equal(t, "0x0fb99d3c8c32262146fa7251931bc2e599fe82a61b8797933dc4c3a91ec73699", hexutil.Encode(mtProof[1]))
		assert.Equal(t, "0xe3fb0d21d47526461cda4cb34257ce48374133a3f1bcb7c8a974bea234ae0718", hexutil.Encode(mtLeaf))
	})

	t.Run("genMerkleTree with 5 leafs", func(t *testing.T) {
		expectRoot := "a4df6caea13914af2c24a75999b7987640542a12fd32524c3e23167212698284"
		mt, root, err := GenRewardMerkleTree([]string{user1, user2, user3, user4, user5}, []string{"100", "200", "100", "200", "100"}, contract, kwilBlock)
		require.NoError(t, err)
		require.Equal(t, expectRoot, root)
		mtFile, err := os.ReadFile(testdataDir + "5leafs_tree.json")
		require.NoError(t, err)
		assert.JSONEq(t, mt, string(mtFile))
		mtProof, mtLeaf, err := GetMTreeProof(mt, user2)
		require.NoError(t, err)
		require.Len(t, mtProof, 2)
		assert.Equal(t, "0x0fb99d3c8c32262146fa7251931bc2e599fe82a61b8797933dc4c3a91ec73699", hexutil.Encode(mtProof[0]))
		assert.Equal(t, "0xf38f00aaa90443ee4735ab771bf54ad4cecf1044934d07d63919c88356eadb27", hexutil.Encode(mtProof[1]))
		assert.Equal(t, "0xe3fb0d21d47526461cda4cb34257ce48374133a3f1bcb7c8a974bea234ae0718", hexutil.Encode(mtLeaf))
	})
}

func TestMessageHash(t *testing.T) {
	//networkOwner := "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
	user1 := "0x976EA74026E726554dB657fA54763abd0C3a0aa9"
	user2 := "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955"
	user3 := "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f"
	//user4 := "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720"
	//user5 := "0xBcd4042DE499D14e55001CcbB24a551F3b954096"
	contract := "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"

	// root hash; NOTE: no 0x prefix
	const root = "2b99d11a9a089537b17930650ae00cadce38788df0b095c1e9f350d7088d24bb"

	t.Run("post reward message hash", func(t *testing.T) {
		h, err := GenPostRewardMessageHash(root, "100", "2", contract)
		require.NoError(t, err)
		assert.Equal(t, "0xc1fd32db667e2a5bf70f256a92fbb3347c5c98f905ea572919df0be34c5bea62", hexutil.Encode(h))
	})

	t.Run("update poster fee message hash", func(t *testing.T) {
		h, err := GenUpdatePosterFeeMessageHash("100", "2", contract)
		require.NoError(t, err)
		assert.Equal(t, "0xaaa86ba9ad647178686eb14611d0244e0e0ba29dbd5651da3b5e591b5ab657a3", hexutil.Encode(h))
	})

	t.Run("update signers message hash", func(t *testing.T) {
		h, err := GenUpdateSignerMessageHash([]string{user1, user2, user3}, "2", "2", contract)
		require.NoError(t, err)
		assert.Equal(t, "0x1095cf42edb93b4f9e443d4bf8eb37086d930ba174d364ca920c8075ca4cdee7", hexutil.Encode(h))
	})
}

func TestSignMessage(t *testing.T) {
	pk := "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
	signer, err := crypto.HexToECDSA(pk)
	require.NoError(t, err)

	msg := "sosup"
	expected := "1fc551d4d1f0901b64432dc59f372beb231adfa2021e1fa5a2cc314df7d98f114ff8afa4603ceee05f768532b615807df8ac358b64b318baaeef5237301240771b"

	sig, err := EthZeppelinSign([]byte(msg), signer)
	require.NoError(t, err)
	assert.Equal(t, expected, hex.EncodeToString(sig))
}
