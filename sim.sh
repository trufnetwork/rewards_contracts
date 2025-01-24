#!/usr/bin/env bash

test "$(basename "$(pwd)")" == "rewards_contracts" || (echo "Plz invoke this script in project root"; exit 1)

. sim.env

# we use sim.env both for substituting docker-compose.yml and for container
COMPOSE="docker-compose --env-file ./sim.env -f docker-compose.yml"


generate-svc-config() {
  tee /tmp/kwil-signersvc-config.json <<EOF > /dev/null
{
  "kwil_rpc": "kwild:8484",
  "private_key": "$TEST_PK",
  "kwil_namespace": "rewards",
  "sync_after_block": 0,
  "sync_every": 30,
  "state_file": "/tmp/kwil-reward-signer-state.json"
}
EOF

  tee /tmp/kwil-postersvc-config.json <<EOF > /dev/null
{
  "eth_rpc": "$SEPOLIA_RPC",
  "private_key": "$TEST_PK",
  "safe_address": "$SEPOLIA_SAFE_ADDRESS",
  "reward_address": "$SEPOLIA_REWARD_ADDRESS",
  "sync_every": 30000,
  "kwil_rpc": "kwild:8484",
  "kwil_chain_id": "kwil-testnet",
  "kwil_namespace": "rewards",
  "state_file": "/tmp/reward-poster-state.json"
}
EOF
}


run() {
  # we always use /tmp/.testnet/node0 as the Kwild root dir
  rm -rf /tmp/.testnet
  docker run --rm -it -v /tmp:/tmp kwil-reward:latest setup testnet -v 1 -o /tmp/.testnet

  generate-svc-config

  $COMPOSE up
  $COMPOSE rm -s -v -f
}


build() {
  cd peripheral/goimpl || exit 1
  test -f go.work && go work vendor || go mod vendor
  cd - || exit 1

  $COMPOSE build
}


"$@"