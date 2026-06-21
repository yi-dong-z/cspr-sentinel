import type { PaymentAdapter, Purchase, Rating, ReputationAnchor, ReputationSnapshot, Service, SettlementResult } from "./types";
import { stableHash } from "./utils";

const fixtures: Record<string, Record<string, unknown>> = {
  service_asset_verification: {
    source: "synthetic-fixture",
    issuerVerified: true,
    documentIntegrity: "matched",
    ownershipChain: "complete",
    maturityDate: "2027-03-31",
    flags: []
  },
  service_risk_intelligence: {
    source: "synthetic-fixture",
    counterpartyRisk: "moderate",
    jurisdictionRisk: "low",
    concentrationRisk: "elevated",
    watchlistMatches: 0,
    explanation: "Exposure is concentrated in one logistics counterparty. No synthetic watchlist matches were found."
  }
};

export class MockPaymentAdapter implements PaymentAdapter {
  async settle(purchase: Purchase, service: Service): Promise<SettlementResult> {
    if (purchase.requestPayload.forceFailure === true) throw new Error("Simulated facilitator failure requested by the test payload.");
    return {
      deployHash: `sim_${stableHash({ purchase: purchase.id, at: Date.now() }).slice(0, 60)}`,
      response: fixtures[service.id] ?? { source: "synthetic-fixture", ok: true },
      chainMode: "simulated"
    };
  }
}

export class MockReputationAnchor implements ReputationAnchor {
  async anchor(purchase: Purchase, agent: ReputationSnapshot, provider: ReputationSnapshot): Promise<string> {
    return `sim_anchor_${stableHash({ purchase: purchase.deployHash, agent: agent.counters, provider: provider.counters }).slice(0, 48)}`;
  }
  async anchorRating(purchase: Purchase, rating: Rating, provider: ReputationSnapshot): Promise<string> {
    return `sim_rating_${stableHash({ purchase: purchase.deployHash, rating, provider: provider.counters }).slice(0, 48)}`;
  }
}
