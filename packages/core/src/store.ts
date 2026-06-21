import type {
  Agent,
  Approval,
  AuditEvent,
  DashboardSnapshot,
  Policy,
  Provider,
  Purchase,
  Rating,
  ReputationSnapshot,
  Service,
  SubjectType
} from "./types";
import { calculateReputation, emptyCounters } from "./reputation";
import { nowIso } from "./utils";

export interface SentinelStore {
  snapshot(): Promise<DashboardSnapshot>;
  getAgent(id: string): Promise<Agent | undefined>;
  getProvider(id: string): Promise<Provider | undefined>;
  getService(id: string): Promise<Service | undefined>;
  listServices(): Promise<Service[]>;
  getPolicy(agentId: string): Promise<Policy | undefined>;
  savePolicy(policy: Policy): Promise<void>;
  getPurchase(id: string): Promise<Purchase | undefined>;
  listPurchases(): Promise<Purchase[]>;
  savePurchase(purchase: Purchase): Promise<void>;
  getApprovalByPurchase(purchaseId: string): Promise<Approval | undefined>;
  saveApproval(approval: Approval): Promise<void>;
  getRatingByPurchase(purchaseId: string): Promise<Rating | undefined>;
  saveRating(rating: Rating): Promise<void>;
  saveAuditEvent(event: AuditEvent): Promise<void>;
  getReputation(subjectId: string, subjectType: SubjectType): Promise<ReputationSnapshot>;
  saveReputation(snapshot: ReputationSnapshot): Promise<void>;
}

const createdAt = "2026-06-20T00:00:00.000Z";

export function seedSnapshot(): DashboardSnapshot {
  const agents: Agent[] = [{ id: "agent_rwa_analyst", name: "RWA Diligence Agent", publicKey: "testnet-key-not-configured", createdAt }];
  const providers: Provider[] = [
    { id: "provider_atlas_verify", name: "Atlas Verify", payee: "testnet-payee-atlas", description: "Synthetic provenance and document consistency checks.", createdAt },
    { id: "provider_meridian_risk", name: "Meridian Risk", payee: "testnet-payee-meridian", description: "Synthetic counterparty and concentration risk intelligence.", createdAt }
  ];
  const services: Service[] = [
    {
      id: "service_asset_verification",
      providerId: "provider_atlas_verify",
      name: "Asset Verification API",
      category: "asset-verification",
      description: "Checks issuer, document hashes, maturity, and ownership chain against synthetic fixtures.",
      endpoint: "/api/providers/asset-verification",
      price: 0.02,
      currency: "WCSPR",
      synthetic: true,
      active: true
    },
    {
      id: "service_risk_intelligence",
      providerId: "provider_meridian_risk",
      name: "Risk Intelligence API",
      category: "risk-intelligence",
      description: "Returns synthetic counterparty, jurisdiction, and concentration risk signals.",
      endpoint: "/api/providers/risk-intelligence",
      price: 0.12,
      currency: "WCSPR",
      synthetic: true,
      active: true
    }
  ];
  const policies: Policy[] = [{
    id: "policy_default",
    agentId: agents[0]!.id,
    allowedServiceIds: services.map((service) => service.id),
    autoApproveLimit: 0.05,
    dailyLimit: 0.5,
    minimumProviderReputation: 45,
    updatedAt: createdAt
  }];
  const reputations = [
    calculateReputation(agents[0]!.id, "agent", emptyCounters()),
    ...providers.map((provider) => calculateReputation(provider.id, "provider", emptyCounters()))
  ];
  return { agents, providers, services, policies, purchases: [], approvals: [], ratings: [], auditEvents: [], reputations };
}

export class MemorySentinelStore implements SentinelStore {
  private state: DashboardSnapshot;

  constructor(initial: DashboardSnapshot = seedSnapshot()) {
    this.state = structuredClone(initial);
  }

  async snapshot(): Promise<DashboardSnapshot> { return structuredClone(this.state); }
  async getAgent(id: string): Promise<Agent | undefined> { return structuredClone(this.state.agents.find((item) => item.id === id)); }
  async getProvider(id: string): Promise<Provider | undefined> { return structuredClone(this.state.providers.find((item) => item.id === id)); }
  async getService(id: string): Promise<Service | undefined> { return structuredClone(this.state.services.find((item) => item.id === id)); }
  async listServices(): Promise<Service[]> { return structuredClone(this.state.services); }
  async getPolicy(agentId: string): Promise<Policy | undefined> { return structuredClone(this.state.policies.find((item) => item.agentId === agentId)); }
  async savePolicy(policy: Policy): Promise<void> { this.upsert("policies", policy); }
  async getPurchase(id: string): Promise<Purchase | undefined> { return structuredClone(this.state.purchases.find((item) => item.id === id)); }
  async listPurchases(): Promise<Purchase[]> { return structuredClone(this.state.purchases); }
  async savePurchase(purchase: Purchase): Promise<void> { this.upsert("purchases", purchase); }
  async getApprovalByPurchase(purchaseId: string): Promise<Approval | undefined> { return structuredClone(this.state.approvals.find((item) => item.purchaseId === purchaseId)); }
  async saveApproval(approval: Approval): Promise<void> { this.upsert("approvals", approval); }
  async getRatingByPurchase(purchaseId: string): Promise<Rating | undefined> { return structuredClone(this.state.ratings.find((item) => item.purchaseId === purchaseId)); }
  async saveRating(rating: Rating): Promise<void> { this.upsert("ratings", rating); }
  async saveAuditEvent(event: AuditEvent): Promise<void> { this.upsert("auditEvents", event); }
  async getReputation(subjectId: string, subjectType: SubjectType): Promise<ReputationSnapshot> {
    return structuredClone(
      this.state.reputations.find((item) => item.subjectId === subjectId && item.subjectType === subjectType)
        ?? calculateReputation(subjectId, subjectType, emptyCounters())
    );
  }
  async saveReputation(snapshot: ReputationSnapshot): Promise<void> {
    const index = this.state.reputations.findIndex((item) => item.subjectId === snapshot.subjectId && item.subjectType === snapshot.subjectType);
    if (index === -1) this.state.reputations.push(structuredClone(snapshot));
    else this.state.reputations[index] = structuredClone(snapshot);
  }

  private upsert<K extends "policies" | "purchases" | "approvals" | "ratings" | "auditEvents">(key: K, item: DashboardSnapshot[K][number]): void {
    const collection = this.state[key] as Array<{ id: string }>;
    const index = collection.findIndex((candidate) => candidate.id === item.id);
    if (index === -1) collection.push(structuredClone(item));
    else collection[index] = structuredClone(item);
  }
}

declare global {
  var __sentinelStore: MemorySentinelStore | undefined;
}

export function getDemoStore(): MemorySentinelStore {
  globalThis.__sentinelStore ??= new MemorySentinelStore();
  return globalThis.__sentinelStore;
}

export function resetDemoStore(): MemorySentinelStore {
  globalThis.__sentinelStore = new MemorySentinelStore();
  return globalThis.__sentinelStore;
}

export function isToday(iso: string, reference = new Date()): boolean {
  const date = new Date(iso);
  return date.getUTCFullYear() === reference.getUTCFullYear()
    && date.getUTCMonth() === reference.getUTCMonth()
    && date.getUTCDate() === reference.getUTCDate();
}

export const touchPolicy = (policy: Policy): Policy => ({ ...policy, updatedAt: nowIso() });
