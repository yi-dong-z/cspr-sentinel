import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "./policy";
import { calculateReputation, emptyCounters } from "./reputation";
import { seedSnapshot } from "./store";

describe("evaluatePolicy", () => {
  const seed = seedSnapshot();
  const policy = seed.policies[0]!;
  const verification = seed.services[0]!;
  const risk = seed.services[1]!;
  const reputation = calculateReputation(verification.providerId, "provider", emptyCounters());

  it("auto-approves a low-price allowed service", () => {
    expect(evaluatePolicy({ policy, service: verification, providerReputation: reputation, purchasesToday: [], requestedMaxAmount: 0.02 }).outcome).toBe("approve");
  });

  it("routes a higher-price service to owner review", () => {
    expect(evaluatePolicy({ policy, service: risk, providerReputation: reputation, purchasesToday: [], requestedMaxAmount: 0.12 }).outcome).toBe("review");
  });

  it("denies an amount above the caller's maximum", () => {
    expect(evaluatePolicy({ policy, service: risk, providerReputation: reputation, purchasesToday: [], requestedMaxAmount: 0.1 })).toMatchObject({ outcome: "deny" });
  });

  it("denies a purchase that would exceed the daily budget", () => {
    const purchase = { ...seed.purchases[0], amount: 0.49, status: "delivered" as const, createdAt: new Date().toISOString() };
    expect(evaluatePolicy({ policy, service: verification, providerReputation: reputation, purchasesToday: [purchase as never], requestedMaxAmount: 0.02 }).outcome).toBe("deny");
  });
});
