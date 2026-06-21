# Casper Testnet Runbook

## Prerequisites

- One ED25519 Casper Testnet wallet for the agent.
- Test CSPR for transaction fees.
- Test WCSPR for x402 payments.
- Two testnet payee account hashes for the provider services.
- A facilitator URL supporting `casper:casper-test` and the configured WCSPR asset.
- A deployed CSPR Sentinel reputation contract and funded operator wallet.

Never commit PEM files or paste private keys into client-side environment variables.

Generate isolated ED25519 wallets once. The command refuses to overwrite existing keys and stores PEM files under the ignored `.secrets/casper` directory with mode 600:

```bash
pnpm wallets:generate
```

After funding the generated `agent` public key once through the official faucet, distribute 100 test CSPR to the facilitator and reputation operator:

```bash
pnpm wallets:fund-roles
```

## Configuration

Next.js runs from `apps/web`, so copy the root example there and set the values:

```bash
cp .env.example apps/web/.env.local
```

Required real-mode values include:

```text
DEMO_MODE=false
NEXT_PUBLIC_APP_URL=https://your-deployment.example
CASPER_AGENT_PRIVATE_KEY=<PEM with newlines encoded as \n>
CASPER_AGENT_PUBLIC_KEY=<hex public key>
CASPER_FACILITATOR_URL=<facilitator origin>
WCSPR_CONTRACT_PACKAGE_HASH=<package hash without secret material>
WCSPR_DECIMALS=9
ASSET_PROVIDER_PAYEE=<account hash>
RISK_PROVIDER_PAYEE=<account hash>
REPUTATION_CONTRACT_HASH=<contract hash>
REPUTATION_OPERATOR_PRIVATE_KEY=<PEM with newlines encoded as \n>
```

The deployment includes an optional official-scheme facilitator at `/api/facilitator`. To self-host it, set `CASPER_FEE_PAYER_PRIVATE_KEY`, point `CASPER_FACILITATOR_URL` to `https://your-deployment.example/api/facilitator`, and fund the fee-payer account with test CSPR. Keep this key separate from the buyer and provider wallets.

Confirm the facilitator advertises the network before running a payment:

```bash
curl "$CASPER_FACILITATOR_URL/supported"
```

The response must contain the `exact` scheme and `casper:casper-test` network.

Run the automated readiness check. It validates formats without printing secrets, probes Casper JSON-RPC, and confirms facilitator support:

```bash
pnpm testnet:preflight
```

After deployment, confirm the production health gate before sending funds:

```bash
curl -f https://your-deployment.example/api/health
```

## Smoke test order

1. Call the Asset Verification API without a payment header and verify HTTP 402.
2. Run the dashboard diligence flow and verify the 0.02 WCSPR purchase reaches `delivered`.
3. Open the transaction hash in the Casper Testnet explorer.
4. Confirm the 0.12 WCSPR request remains `pending_approval` before any payment is signed.
5. Approve it as the GitHub owner and verify settlement.
6. Submit one provider rating and confirm a second rating returns HTTP 409.
7. Query the reputation contract and compare its counters with the dashboard.

## Failure checks

- An unfunded signer must end in `failed`, not `delivered`.
- A mismatched token domain must be reported as a facilitator signature failure.
- A price above `max_amount` must end in `policy_denied` with no transaction hash.
- An unauthenticated production approval request must return HTTP 401.
- A duplicate payment receipt or duplicate rating must revert in the contract.
