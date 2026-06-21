import { calculateReputation } from "./reputation";
import { evaluatePolicy } from "./policy";
import { isToday, type SentinelStore } from "./store";
import type { Approval, PaymentAdapter, Purchase, Rating, ReputationAnchor, Service } from "./types";
import { createId, nowIso, stableHash } from "./utils";

export class SentinelError extends Error {
  constructor(message: string, readonly code: string, readonly status = 400) {
    super(message);
  }
}

export interface RequestPurchaseInput {
  agentId: string;
  serviceId: string;
  payload: Record<string, unknown>;
  maxAmount: number;
}

export class SentinelEngine {
  constructor(
    private readonly store: SentinelStore,
    private readonly payments: PaymentAdapter,
    private readonly anchor?: ReputationAnchor
  ) {}

  async requestPurchase(input: RequestPurchaseInput): Promise<Purchase> {
    const [agent, service, policy] = await Promise.all([
      this.store.getAgent(input.agentId),
      this.store.getService(input.serviceId),
      this.store.getPolicy(input.agentId)
    ]);
    if (!agent) throw new SentinelError("Agent was not found.", "agent_not_found", 404);
    if (!service) throw new SentinelError("Service was not found.", "service_not_found", 404);
    if (!policy) throw new SentinelError("Agent policy was not found.", "policy_not_found", 404);

    const providerReputation = await this.store.getReputation(service.providerId, "provider");
    const purchasesToday = (await this.store.listPurchases()).filter((purchase) => purchase.agentId === input.agentId && isToday(purchase.createdAt));
    const decision = evaluatePolicy({ policy, service, providerReputation, purchasesToday, requestedMaxAmount: input.maxAmount });
    const time = nowIso();
    const purchase: Purchase = {
      id: createId("purchase"),
      agentId: input.agentId,
      providerId: service.providerId,
      serviceId: service.id,
      amount: service.price,
      currency: "WCSPR",
      status: decision.outcome === "deny" ? "policy_denied" : decision.outcome === "review" ? "pending_approval" : "requested",
      policyReason: decision.reason,
      requestPayload: input.payload,
      requestHash: stableHash(input.payload),
      chainMode: "simulated",
      createdAt: time,
      updatedAt: time
    };
    await this.store.savePurchase(purchase);
    await this.audit(purchase.id, "policy_evaluated", "system", decision.reason, { outcome: decision.outcome });
    await this.recordPolicyAttempt(purchase, decision.outcome !== "deny");

    if (decision.outcome === "review") {
      const approval: Approval = {
        id: createId("approval"),
        purchaseId: purchase.id,
        decision: "pending",
        createdAt: time
      };
      await this.store.saveApproval(approval);
      await this.audit(purchase.id, "approval_requested", "agent", "Owner approval is required before payment.", { amount: purchase.amount });
      return purchase;
    }
    if (decision.outcome === "deny") return purchase;
    return this.executePurchase(purchase, service);
  }

  async resolveApproval(purchaseId: string, decision: "approved" | "rejected", actor: string, reason?: string): Promise<Purchase> {
    const [purchase, approval] = await Promise.all([
      this.store.getPurchase(purchaseId),
      this.store.getApprovalByPurchase(purchaseId)
    ]);
    if (!purchase || !approval) throw new SentinelError("Pending approval was not found.", "approval_not_found", 404);
    if (purchase.status !== "pending_approval" || approval.decision !== "pending") {
      throw new SentinelError("This approval has already been resolved.", "approval_already_resolved", 409);
    }
    const time = nowIso();
    await this.store.saveApproval({ ...approval, decision, ...(reason ? { reason } : {}), decidedBy: actor, decidedAt: time });
    await this.recordApprovalOutcome(purchase.agentId, decision === "approved");
    if (decision === "rejected") {
      const rejected = { ...purchase, status: "policy_denied" as const, policyReason: reason ?? "Owner rejected the purchase.", updatedAt: time };
      await this.store.savePurchase(rejected);
      await this.audit(purchase.id, "approval_rejected", "owner", rejected.policyReason, {});
      return rejected;
    }
    const approved = { ...purchase, status: "approved" as const, updatedAt: time };
    await this.store.savePurchase(approved);
    await this.audit(purchase.id, "approval_granted", "owner", "Owner approved the purchase.", {});
    const service = await this.store.getService(purchase.serviceId);
    if (!service) throw new SentinelError("Service was not found.", "service_not_found", 404);
    return this.executePurchase(approved, service);
  }

  async submitProviderRating(purchaseId: string, score: number, evidenceHash: string): Promise<Rating> {
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      throw new SentinelError("Rating must be an integer from 1 to 5.", "invalid_rating");
    }
    const purchase = await this.store.getPurchase(purchaseId);
    if (!purchase || purchase.status !== "delivered" || !purchase.deployHash) {
      throw new SentinelError("Only a verified, delivered purchase can be rated.", "purchase_not_rateable", 409);
    }
    if (await this.store.getRatingByPurchase(purchaseId)) {
      throw new SentinelError("This purchase has already been rated.", "duplicate_rating", 409);
    }
    const rating: Rating = {
      id: createId("rating"), purchaseId, providerId: purchase.providerId, agentId: purchase.agentId,
      score, evidenceHash, createdAt: nowIso()
    };
    await this.store.saveRating(rating);
    const provider = await this.store.getReputation(purchase.providerId, "provider");
    const counters = { ...provider.counters, ratingCount: provider.counters.ratingCount + 1, ratingSum: provider.counters.ratingSum + score };
    const snapshot = calculateReputation(purchase.providerId, "provider", counters);
    await this.store.saveReputation(snapshot);
    if (this.anchor?.anchorRating) {
      const anchorHash = await this.anchor.anchorRating(purchase, rating, snapshot);
      if (anchorHash) await this.store.saveReputation({ ...snapshot, lastAnchorHash: anchorHash });
    }
    await this.audit(purchase.id, "provider_rated", "agent", "Verified buyer rating recorded.", { score, evidenceHash });
    return rating;
  }

  private async executePurchase(purchase: Purchase, service: Service): Promise<Purchase> {
    const paying = { ...purchase, status: "paying" as const, updatedAt: nowIso() };
    await this.store.savePurchase(paying);
    await this.recordPaymentAttempt(purchase.agentId, false);
    await this.audit(purchase.id, "payment_started", "system", "Payment authorization is being settled.", { amount: purchase.amount });
    try {
      const result = await this.payments.settle(paying, service);
      const settled: Purchase = {
        ...paying,
        status: "settled",
        deployHash: result.deployHash,
        chainMode: result.chainMode,
        updatedAt: nowIso()
      };
      await this.store.savePurchase(settled);
      await this.recordPaymentAttempt(purchase.agentId, true, true);
      await this.audit(purchase.id, "payment_settled", "system", result.chainMode === "testnet" ? "Casper Testnet settlement confirmed." : "Simulated settlement completed.", { deployHash: result.deployHash, chainMode: result.chainMode });
      const delivered: Purchase = {
        ...settled,
        status: "delivered",
        responsePayload: result.response,
        responseHash: stableHash(result.response),
        updatedAt: nowIso()
      };
      await this.store.savePurchase(delivered);
      await this.recordProviderDelivery(purchase.providerId, true);
      await this.audit(purchase.id, "service_delivered", "system", "Paid service response was delivered.", { responseHash: delivered.responseHash });
      await this.anchorReputations(delivered);
      return delivered;
    } catch (error) {
      const failed: Purchase = { ...paying, status: "failed", policyReason: error instanceof Error ? error.message : "Settlement failed.", updatedAt: nowIso() };
      await this.store.savePurchase(failed);
      await this.recordProviderDelivery(purchase.providerId, false);
      await this.audit(purchase.id, "payment_failed", "system", failed.policyReason, {});
      return failed;
    }
  }

  private async recordPolicyAttempt(purchase: Purchase, compliant: boolean): Promise<void> {
    const current = await this.store.getReputation(purchase.agentId, "agent");
    const counters = { ...current.counters, policyAttempts: current.counters.policyAttempts + 1, policyCompliant: current.counters.policyCompliant + (compliant ? 1 : 0) };
    await this.store.saveReputation(calculateReputation(purchase.agentId, "agent", counters));
  }

  private async recordPaymentAttempt(agentId: string, success: boolean, replacePending = false): Promise<void> {
    const current = await this.store.getReputation(agentId, "agent");
    const counters = { ...current.counters };
    if (!replacePending) counters.paymentAttempts += 1;
    if (success) counters.paymentSuccesses += 1;
    await this.store.saveReputation(calculateReputation(agentId, "agent", counters));
  }

  private async recordApprovalOutcome(agentId: string, approved: boolean): Promise<void> {
    const current = await this.store.getReputation(agentId, "agent");
    const counters = { ...current.counters, approvalResolved: current.counters.approvalResolved + 1, approvalApproved: current.counters.approvalApproved + (approved ? 1 : 0) };
    await this.store.saveReputation(calculateReputation(agentId, "agent", counters));
  }

  private async recordProviderDelivery(providerId: string, success: boolean): Promise<void> {
    const current = await this.store.getReputation(providerId, "provider");
    const counters = { ...current.counters, deliveryAttempts: current.counters.deliveryAttempts + 1, deliverySuccesses: current.counters.deliverySuccesses + (success ? 1 : 0) };
    await this.store.saveReputation(calculateReputation(providerId, "provider", counters));
  }

  private async anchorReputations(purchase: Purchase): Promise<void> {
    if (!this.anchor) return;
    const [agent, provider] = await Promise.all([
      this.store.getReputation(purchase.agentId, "agent"),
      this.store.getReputation(purchase.providerId, "provider")
    ]);
    const hash = await this.anchor.anchor(purchase, agent, provider);
    if (!hash) return;
    await Promise.all([
      this.store.saveReputation({ ...agent, lastAnchorHash: hash }),
      this.store.saveReputation({ ...provider, lastAnchorHash: hash })
    ]);
  }

  private async audit(purchaseId: string, type: string, actor: "agent" | "owner" | "system", message: string, metadata: Record<string, unknown>): Promise<void> {
    await this.store.saveAuditEvent({ id: createId("event"), purchaseId, type, actor, message, metadata, createdAt: nowIso() });
  }
}
