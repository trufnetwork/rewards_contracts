#!/usr/bin/env bash

set -e

test "$(basename "$(pwd)")" == "rewards_contracts" || (echo "Plz invoke this script in project root"; exit 1)

source ./.env

# we use .env both for substituting docker-compose.yml and for container
COMPOSE="docker-compose --env-file .env -f docker-compose.yml"

_generate-svc-config() {
  tee /tmp/kwil-reward-postersvc-config.json <<EOF > /dev/null
{
  "eth_rpc": "$SEPOLIA_RPC",
  "private_key": "$TEST_PK",
  "kwil_rpc": "http://kwild:8484",
  "kwil_chain_id": "kwil-testnet",
  "kwil_namespace": "rewards",
  "sync_every": 30000,
  "state_file": "/tmp/kwil-reward-postersvc-state.json"
}
EOF
}


run-fresh() {
  # we always use /tmp/.testnet/node0 as the Kwild root dir
  rm -rf /tmp/.testnet
  docker run --rm -it -v /tmp:/tmp kwild:latest setup testnet -v 1 -o /tmp/.testnet
  perl -i -pe "s/^.*\"db_owner\":.*$/  \"db_owner\": \"$TEST_ADDRESS\",/g" /tmp/.testnet/node0/genesis.json

  _generate-svc-config

  $COMPOSE up
  $COMPOSE rm -s -v -f
}

#run-old() {
#  generate-svc-config
#
#  $COMPOSE up
#  $COMPOSE rm -s -v -f
#}


build() {
#  cd peripheral/goimpl || exit 1
#  test -f go.work && go work vendor || go mod vendor
#  cd - || exit 1

  $COMPOSE build
}

test $# -eq 0 && (echo Availbale funcs:;echo; declare -F | awk '{print $3}'; exit 1)

"$@"