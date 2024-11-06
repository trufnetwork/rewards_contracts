##
npx hardhat compile
etheno --ganache --ganache-args "--gasLimit=0x1fffffffffffff --allowUnlimitedContractSize -e 1000000000" -x ./setup.json

npx hardhat ignition deploy ./ignition/modules/KwilMockToken.ts --network localhost
### change token address in ./ignition/modules/RewardDistributor.ts
npx hardhat ignition deploy ./ignition/modules/RewardDistributor.ts --network localhost

echo initialize: setup.json >> test.yaml

##
docker run -it --rm -v $PWD:/code trailofbits/eth-security-toolbox
cd /code
### change TestRewardDistributor.addr to deployed contract address.
echidna . --contract TestRewardDistributor