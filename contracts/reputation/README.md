# CSPR Sentinel Reputation Contract

This Odra contract stores bilateral reputation aggregates and binds each update to an x402 payment deploy hash.

It intentionally does not store due diligence reports, request payloads, or free-text reviews. Those records remain off-chain. The contract stores only counters, evidence hashes, and uniqueness guards.

## Entry points

- `init(operator)` assigns the application operator.
- `record_purchase(...)` anchors one verified x402 purchase and updates both subjects.
- `record_provider_rating(...)` permits one provider rating update for an anchored purchase.
- `get_counters(subject_id)` returns raw aggregates. Score weights remain upgradeable in the application.

The contract targets Odra 2.8 and pins the framework-compatible `nightly-2026-01-01` toolchain through `rust-toolchain.toml`.

```bash
cargo install cargo-odra --version 0.1.7
cargo test
cargo odra build
```

Deploy the generated contract against Casper Testnet according to the [Odra documentation](https://odra.dev/docs/). Set the resulting contract hash as `REPUTATION_CONTRACT_HASH`.
