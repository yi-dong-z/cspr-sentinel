import type { ReputationCounters, ReputationSnapshot, SubjectType } from "./types";
import { nowIso, roundScore } from "./utils";

export const emptyCounters = (): ReputationCounters => ({
  paymentAttempts: 0,
  paymentSuccesses: 0,
  policyAttempts: 0,
  policyCompliant: 0,
  approvalResolved: 0,
  approvalApproved: 0,
  deliveryAttempts: 0,
  deliverySuccesses: 0,
  ratingCount: 0,
  ratingSum: 0
});

const ratio = (numerator: number, denominator: number): number => (denominator === 0 ? 0.5 : numerator / denominator);

export function calculateReputation(subjectId: string, subjectType: SubjectType, counters: ReputationCounters): ReputationSnapshot {
  const hasHistory = subjectType === "provider"
    ? counters.deliveryAttempts > 0 || counters.ratingCount > 0
    : counters.paymentAttempts > 0 || counters.policyAttempts > 0;

  if (!hasHistory) {
    return { subjectId, subjectType, score: 50, label: "Unproven", counters, updatedAt: nowIso() };
  }

  const raw = subjectType === "provider"
    ? ratio(counters.ratingSum, counters.ratingCount * 5) * 100 * 0.6
      + ratio(counters.deliverySuccesses, counters.deliveryAttempts) * 100 * 0.4
    : ratio(counters.paymentSuccesses, counters.paymentAttempts) * 100 * 0.5
      + ratio(counters.policyCompliant, counters.policyAttempts) * 100 * 0.3
      + ratio(counters.approvalApproved, counters.approvalResolved) * 100 * 0.2;

  const score = roundScore(raw);
  const label = score >= 85 ? "High trust" : score >= 70 ? "Trusted" : "Developing";
  return { subjectId, subjectType, score, label, counters, updatedAt: nowIso() };
}
