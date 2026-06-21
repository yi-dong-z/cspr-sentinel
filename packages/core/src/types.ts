export const PURCHASE_STATUSES = [
  "requested",
  "policy_denied",
  "pending_approval",
  "approved",
  "paying",
  "settled",
  "delivered",
  "failed"
] as const;

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];
export type SubjectType = "agent" | "provider";
export type ApprovalDecision = "pending" | "approved" | "rejected";

export interface Agent {
  id: string;
  name: string;
  publicKey: string;
  createdAt: string;
}

export interface Provider {
  id: string;
  name: string;
  payee: string;
  description: string;
  createdAt: string;
}

export interface Service {
  id: string;
  providerId: string;
  name: string;
  category: "asset-verification" | "risk-intelligence";
  description: string;
  endpoint: string;
  price: number;
  currency: "WCSPR";
  synthetic: true;
  active: boolean;
}

export interface Policy {
  id: string;
  agentId: string;
  allowedServiceIds: string[];
  autoApproveLimit: number;
  dailyLimit: number;
  minimumProviderReputation: number;
  updatedAt: string;
}

export interface Purchase {
  id: string;
  agentId: string;
  providerId: string;
  serviceId: string;
  amount: number;
  currency: "WCSPR";
  status: PurchaseStatus;
  policyReason: string;
  requestPayload: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  requestHash: string;
  responseHash?: string;
  deployHash?: string;
  chainMode: "simulated" | "testnet";
  createdAt: string;
  updatedAt: string;
}

export interface Approval {
  id: string;
  purchaseId: string;
  decision: ApprovalDecision;
  reason?: string;
  decidedBy?: string;
  createdAt: string;
  decidedAt?: string;
}

export interface Rating {
  id: string;
  purchaseId: string;
  providerId: string;
  agentId: string;
  score: number;
  evidenceHash: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  purchaseId?: string;
  type: string;
  actor: "agent" | "owner" | "system";
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ReputationCounters {
  paymentAttempts: number;
  paymentSuccesses: number;
  policyAttempts: number;
  policyCompliant: number;
  approvalResolved: number;
  approvalApproved: number;
  deliveryAttempts: number;
  deliverySuccesses: number;
  ratingCount: number;
  ratingSum: number;
}

export interface ReputationSnapshot {
  subjectId: string;
  subjectType: SubjectType;
  score: number;
  label: "Unproven" | "Developing" | "Trusted" | "High trust";
  counters: ReputationCounters;
  lastAnchorHash?: string;
  updatedAt: string;
}

export interface DashboardSnapshot {
  agents: Agent[];
  providers: Provider[];
  services: Service[];
  policies: Policy[];
  purchases: Purchase[];
  approvals: Approval[];
  ratings: Rating[];
  auditEvents: AuditEvent[];
  reputations: ReputationSnapshot[];
}

export interface SettlementResult {
  deployHash: string;
  response: Record<string, unknown>;
  chainMode: "simulated" | "testnet";
}

export interface PaymentAdapter {
  settle(purchase: Purchase, service: Service): Promise<SettlementResult>;
}

export interface ReputationAnchor {
  anchor(
    purchase: Purchase,
    agent: ReputationSnapshot,
    provider: ReputationSnapshot
  ): Promise<string | undefined>;
  anchorRating?(
    purchase: Purchase,
    rating: Rating,
    provider: ReputationSnapshot
  ): Promise<string | undefined>;
}
