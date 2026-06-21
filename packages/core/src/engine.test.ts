import { describe, expect, it } from "vitest";
import { SentinelEngine, SentinelError } from "./engine";
import { MockPaymentAdapter, MockReputationAnchor } from "./mock";
import { MemorySentinelStore } from "./store";

describe("SentinelEngine", () => {
  it("settles a policy-compliant low-value purchase", async () => {
    const store = new MemorySentinelStore();
    const engine = new SentinelEngine(store, new MockPaymentAdapter(), new MockReputationAnchor());
    const purchase = await engine.requestPurchase({ agentId: "agent_rwa_analyst", serviceId: "service_asset_verification", payload: { id: "asset-1" }, maxAmount: 0.02 });
    expect(purchase.status).toBe("delivered");
    expect(purchase.deployHash).toMatch(/^sim_/);
    expect((await store.getReputation("agent_rwa_analyst", "agent")).counters.paymentSuccesses).toBe(1);
  });

  it("holds a high-value purchase for explicit approval", async () => {
    const store = new MemorySentinelStore();
    const engine = new SentinelEngine(store, new MockPaymentAdapter());
    const pending = await engine.requestPurchase({ agentId: "agent_rwa_analyst", serviceId: "service_risk_intelligence", payload: { id: "asset-1" }, maxAmount: 0.12 });
    expect(pending.status).toBe("pending_approval");
    const delivered = await engine.resolveApproval(pending.id, "approved", "owner");
    expect(delivered.status).toBe("delivered");
  });

  it("allows one rating per delivered purchase", async () => {
    const store = new MemorySentinelStore();
    const engine = new SentinelEngine(store, new MockPaymentAdapter());
    const purchase = await engine.requestPurchase({ agentId: "agent_rwa_analyst", serviceId: "service_asset_verification", payload: { id: "asset-1" }, maxAmount: 0.02 });
    await engine.submitProviderRating(purchase.id, 4, "evidence-hash");
    await expect(engine.submitProviderRating(purchase.id, 5, "another-evidence")).rejects.toMatchObject({ code: "duplicate_rating" });
  });

  it("records a denied attempt without signing", async () => {
    const store = new MemorySentinelStore();
    const engine = new SentinelEngine(store, new MockPaymentAdapter());
    const purchase = await engine.requestPurchase({ agentId: "agent_rwa_analyst", serviceId: "service_asset_verification", payload: {}, maxAmount: 0.001 });
    expect(purchase.status).toBe("policy_denied");
    expect(purchase.deployHash).toBeUndefined();
  });
});
