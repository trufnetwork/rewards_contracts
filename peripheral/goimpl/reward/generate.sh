#!/usr/bin/env bash
set -e

echo "Generate abi binding for RewardDistributor contract, to reward/contract.go"

cat ../../../artifacts/contracts/RewardDistributor.sol/RewardDistributor.json | jq .abi > /tmp/reward.abi
abigen --abi=/tmp/reward.abi --pkg=reward --out=contract.go