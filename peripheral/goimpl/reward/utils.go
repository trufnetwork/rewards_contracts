package reward

import (
	"crypto/ecdsa"
	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/crypto"
)

// EthZeppelinSign generate a OpenZeppelin compatible signature.
// The produced signature is in the [R || S || V] format where V is 27 or 28.
func EthZeppelinSign(msg []byte, key *ecdsa.PrivateKey) ([]byte, error) {
	sig, err := crypto.Sign(accounts.TextHash(msg), key)
	if err != nil {
		return nil, err
	}

	sig[len(sig)-1] += 27
	return sig, nil
}
