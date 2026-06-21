import { describe, expect, it } from "vitest";
import { calculateReputation, emptyCounters } from "./reputation";

describe("calculateReputation", () => {
  it("starts unproven subjects at a neutral score", () => {
    expect(calculateReputation("subject", "agent", emptyCounters())).toMatchObject({ score: 50, label: "Unproven" });
  });

  it("weights provider ratings at 60 percent and delivery at 40 percent", () => {
    const counters = { ...emptyCounters(), ratingCount: 2, ratingSum: 8, deliveryAttempts: 2, deliverySuccesses: 2 };
    expect(calculateReputation("provider", "provider", counters).score).toBe(88);
  });

  it("weights agent payment, policy, and approval behavior", () => {
    const counters = {
      ...emptyCounters(), paymentAttempts: 4, paymentSuccesses: 3, policyAttempts: 5, policyCompliant: 5,
      approvalResolved: 2, approvalApproved: 1
    };
    expect(calculateReputation("agent", "agent", counters).score).toBe(78);
  });
});
