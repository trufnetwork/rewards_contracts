package goimpl

import (
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"goimpl/poster"
	"goimpl/reward"
)

func main() {
	client, err := ethclient.Dial(rpc)
	if err != nil {
		panic(err)
	}
	addr := common.HexToAddress("0x147B8eb97fD247D06C4006D269c90C1908Fb5D54")

	reward.NewReward(addr, client)
	up, err := poster.NewEVMUploader()
}
