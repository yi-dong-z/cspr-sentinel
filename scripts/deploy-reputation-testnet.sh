#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEY="$ROOT/.secrets/casper/reputation-operator.pem"
RPC="${CASPER_RPC_URL:-https://node.testnet.casper.network/rpc}"
EVENTS="${CASPER_EVENTS_URL:-https://node.testnet.casper.network/events}"
IMAGE="${ODRA_DOCKER_IMAGE:-rustlang/rust:nightly-bookworm}"

if [[ ! -f "$KEY" ]]; then
  echo "Missing $KEY. Run pnpm wallets:generate first." >&2
  exit 1
fi

mkdir -p "$ROOT/.cache/cargo-registry" "$ROOT/resources"

docker run --rm \
  -v "$ROOT:/repo" \
  -v "$ROOT/.cache/cargo-registry:/usr/local/cargo/registry" \
  -w /repo/contracts/reputation \
  -e ODRA_CASPER_LIVENET_SECRET_KEY_PATH=/repo/.secrets/casper/reputation-operator.pem \
  -e ODRA_CASPER_LIVENET_NODE_ADDRESS="$RPC" \
  -e ODRA_CASPER_LIVENET_EVENTS_URL="$EVENTS" \
  -e ODRA_CASPER_LIVENET_CHAIN_NAME=casper-test \
  "$IMAGE" \
  cargo run --locked --bin cspr_sentinel_reputation_cli -- \
  --contracts-toml resources/testnet-contracts.toml deploy --deploy-mode default
