import {
  getDemoStore,
  MockPaymentAdapter,
  MockReputationAnchor,
  NeonSentinelStore,
  SentinelEngine,
  type SentinelStore
} from "@cspr-sentinel/core";
import { CasperX402PaymentAdapter, x402Configured } from "./x402";
import { CasperReputationAnchor, reputationAnchorConfigured } from "./reputation-anchor";

declare global {
  var __neonSentinelStore: NeonSentinelStore | undefined;
}

export function getStore(): SentinelStore {
  if (process.env.DATABASE_URL) {
    globalThis.__neonSentinelStore ??= new NeonSentinelStore(process.env.DATABASE_URL);
    return globalThis.__neonSentinelStore;
  }
  return getDemoStore();
}

export function getEngine(): SentinelEngine {
  assertRealModeConfiguration();
  const payment = process.env.DEMO_MODE === "false"
    ? new CasperX402PaymentAdapter()
    : new MockPaymentAdapter();
  const anchor = process.env.DEMO_MODE === "false"
    ? new CasperReputationAnchor()
    : new MockReputationAnchor();
  return new SentinelEngine(getStore(), payment, anchor);
}

export function runtimeMode(): "simulated" | "testnet" {
  assertRealModeConfiguration();
  return process.env.DEMO_MODE === "false" ? "testnet" : "simulated";
}

function assertRealModeConfiguration(): void {
  if (process.env.DEMO_MODE !== "false") return;
  const missing = [
    !x402Configured() && "Casper x402 payment settings",
    !reputationAnchorConfigured() && "reputation contract settings"
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`Real mode is incomplete: missing ${missing.join(" and ")}. Refusing to use simulated settlement.`);
  }
}
