#!/usr/bin/env bash

test `basename $(pwd)` == "rewards_contracts" || (echo "Plz invoke this script in project root"; exit 1)


#build() {
#    cd goimpl
#    go build . && ./erc20-reward-extension setup testnet -v 1
#    go mod vendor
#    docker build -t kwild-reward:latest .
#
#    cd -
#}

run() {
  docker-compose -f periperal/docker-compose.yml up
  docker-compose -f periperal/docker-compose.yml rm -v -f
}
