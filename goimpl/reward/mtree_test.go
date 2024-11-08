package reward

import (
	"os"
	"testing"

	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMerkleTree(t *testing.T) {
	addr1 := "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
	addr2 := "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
	addr3 := "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
	addr4 := "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
	addr5 := "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
	contract := "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"

	testdataDir := "../../test/testdata/"

	t.Run("genMerkleTree with 3 leafs", func(t *testing.T) {
		expectRoot := "e4b867aad8e2ed878496a1d11f020ec3e2cb4470e552bbaeb5d3cb8b633b7d60"
		mt, root, err := GenRewardMerkleTree([]string{addr1, addr2, addr3}, []string{"100", "200", "100"}, contract)
		require.NoError(t, err)
		require.Equal(t, expectRoot, root)
		mtFile, err := os.ReadFile(testdataDir + "3leafs_tree.json")
		require.NoError(t, err)
		assert.JSONEq(t, mt, string(mtFile))
		mtProof, mtLeaf, err := GetMTreeProof(mt, addr3)
		require.NoError(t, err)
		require.Len(t, mtProof, 1)
		assert.Equal(t, "0x2f87038f22c4d34c3b4a790a5feeabe33502a6ce9db946d119e9f02ee2c616f9", hexutil.Encode(mtProof[0]))
		assert.Equal(t, "0xe8e4b2dfdc4cd3b98cb2b8a0562554fb20fa55b0a56051a4477a32317de956eb", hexutil.Encode(mtLeaf))
	})

	t.Run("genMerkleTree with 4 leafs", func(t *testing.T) {
		expectRoot := "0e0cf3eb9e1fd0acb0a0a8131bea8fd9ea7182ef52a94e8b402dedd7cd2c713c"
		mt, root, err := GenRewardMerkleTree([]string{addr1, addr2, addr3, addr4}, []string{"100", "200", "100", "200"}, contract)
		require.NoError(t, err)
		require.Equal(t, expectRoot, root)
		mtFile, err := os.ReadFile(testdataDir + "4leafs_tree.json")
		require.NoError(t, err)
		assert.JSONEq(t, mt, string(mtFile))
		mtProof, mtLeaf, err := GetMTreeProof(mt, addr3)
		require.NoError(t, err)
		require.Len(t, mtProof, 2)
		assert.Equal(t, "0x843c5da35b6dec0d96b1667418b89fb8650c0c011fe4622b1304b55bfe1b5d9d", hexutil.Encode(mtProof[0]))
		assert.Equal(t, "0x195aca1e2ee1f09f900f6174cb3ea54d325f29ad05919a4e4416e1c0558a44d6", hexutil.Encode(mtProof[1]))
		assert.Equal(t, "0xe8e4b2dfdc4cd3b98cb2b8a0562554fb20fa55b0a56051a4477a32317de956eb", hexutil.Encode(mtLeaf))
	})

	t.Run("genMerkleTree with 5 leafs", func(t *testing.T) {
		expectRoot := "826d202df86ddc011ba185b4073a80af0b928984893d31fd91221a74094bd062"
		mt, root, err := GenRewardMerkleTree([]string{addr1, addr2, addr3, addr4, addr5}, []string{"100", "200", "100", "200", "100"}, contract)
		require.NoError(t, err)
		require.Equal(t, expectRoot, root)
		mtFile, err := os.ReadFile(testdataDir + "5leafs_tree.json")
		require.NoError(t, err)
		assert.JSONEq(t, mt, string(mtFile))
		mtProof, mtLeaf, err := GetMTreeProof(mt, addr3)
		require.NoError(t, err)
		require.Len(t, mtProof, 2)
		assert.Equal(t, "0x195aca1e2ee1f09f900f6174cb3ea54d325f29ad05919a4e4416e1c0558a44d6", hexutil.Encode(mtProof[0]))
		assert.Equal(t, "0x038afff99cec2e245a14b191c62ff961b5d4b288634e01b64fd0af40609c0efd", hexutil.Encode(mtProof[1]))
		assert.Equal(t, "0xe8e4b2dfdc4cd3b98cb2b8a0562554fb20fa55b0a56051a4477a32317de956eb", hexutil.Encode(mtLeaf))
	})
}

func TestMessageHash(t *testing.T) {
	const addr1 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
	const addr2 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
	const addr3 = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
	const addr4 = "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
	const addr5 = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
	const contract = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"

	// root hash; NOTE: no 0x prefix
	const root = "2b99d11a9a089537b17930650ae00cadce38788df0b095c1e9f350d7088d24bb"

	t.Run("post reward message hash", func(t *testing.T) {
		h, err := GenPostRewardMessageHash(root, "100", "2", contract)
		require.NoError(t, err)
		assert.Equal(t, hexutil.Encode(h), "0xc49ce1c0fc2fb8cbdce3bceabff54675091caeda76cdee9ce0a139bd79cd8c02")
	})

	t.Run("update poster fee message hash", func(t *testing.T) {
		h, err := GenUpdatePosterFeeMessageHash("100", "2", contract)
		require.NoError(t, err)
		assert.Equal(t, hexutil.Encode(h), "0x3b8eb0e42096e2ef3e56d9b88604477f25dc2102073f5b4e1967044150d8bec4")
	})

	t.Run("update signers message hash", func(t *testing.T) {
		h, err := GenUpdateSignerMessageHash([]string{addr2, addr3, addr4}, "2", "2", contract)
		require.NoError(t, err)
		assert.Equal(t, hexutil.Encode(h), "0x657af792d8a50027b119611226f5deb512dcc3e8cfc75861ceaa506f51ad2141")
	})
}
