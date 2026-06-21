import type { Policy, Purchase, ReputationSnapshot, Service } from "./types";

export type PolicyDecision =
  | { outcome: "deny"; reason: string }
  | { outcome: "approve"; reason: string }
  | { outcome: "review"; reason: string };

export interface PolicyContext {
  policy: Policy;
  service: Service;
  providerReputation: ReputationSnapshot;
  purchasesToday: Purchase[];
  requestedMaxAmount: number;
}

export function evaluatePolicy(context: PolicyContext): PolicyDecision {
  const { policy, service, providerReputation, purchasesToday, requestedMaxAmount } = context;
  if (!service.active || !policy.allowedServiceIds.includes(service.id)) {
    return { outcome: "deny", reason: "Service is not allowed by the active policy." };
  }
  if (service.price > requestedMaxAmount) {
    return { outcome: "deny", reason: "Quoted price exceeds the agent's maximum authorized amount." };
  }
  if (providerReputation.score < policy.minimumProviderReputation) {
    return { outcome: "deny", reason: "Provider reputation is below the required threshold." };
  }
  const spentToday = purchasesToday
    .filter((purchase) => ["paying", "settled", "delivered"].includes(purchase.status))
    .reduce((sum, purchase) => sum + purchase.amount, 0);
  if (spentToday + service.price > policy.dailyLimit) {
    return { outcome: "deny", reason: "Purchase would exceed the daily spending limit." };
  }
  if (service.price > policy.autoApproveLimit) {
    return { outcome: "review", reason: "Amount exceeds the automatic approval threshold." };
  }
  return { outcome: "approve", reason: "Purchase satisfies all policy controls." };
}
