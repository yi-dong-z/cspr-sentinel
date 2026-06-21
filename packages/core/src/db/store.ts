import { neon } from "@neondatabase/serverless";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { calculateReputation, emptyCounters } from "../reputation";
import { seedSnapshot, type SentinelStore } from "../store";
import type { Agent, Approval, AuditEvent, DashboardSnapshot, Policy, Provider, Purchase, Rating, ReputationSnapshot, Service, SubjectType } from "../types";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

export class NeonSentinelStore implements SentinelStore {
  private readonly db: Database;

  constructor(databaseUrl: string) {
    this.db = drizzle(neon(databaseUrl), { schema });
  }

  async ensureSeeded(): Promise<void> {
    const rows = await this.db.select({ id: schema.agents.id }).from(schema.agents).limit(1);
    if (rows.length > 0) return;
    const seed = seedSnapshot();
    await Promise.all([
      ...seed.agents.map((item) => this.upsertAgent(item)),
      ...seed.providers.map((item) => this.upsertProvider(item)),
      ...seed.services.map((item) => this.upsertService(item)),
      ...seed.policies.map((item) => this.savePolicy(item)),
      ...seed.reputations.map((item) => this.saveReputation(item))
    ]);
  }

  async snapshot(): Promise<DashboardSnapshot> {
    await this.ensureSeeded();
    const [agentRows, providerRows, serviceRows, policyRows, purchaseRows, approvalRows, ratingRows, auditRows, reputationRows] = await Promise.all([
      this.db.select().from(schema.agents), this.db.select().from(schema.providers), this.db.select().from(schema.services),
      this.db.select().from(schema.policies), this.db.select().from(schema.purchases), this.db.select().from(schema.approvals),
      this.db.select().from(schema.ratings), this.db.select().from(schema.auditEvents), this.db.select().from(schema.reputations)
    ]);
    return {
      agents: agentRows.map((row) => row.payload), providers: providerRows.map((row) => row.payload), services: serviceRows.map((row) => row.payload),
      policies: policyRows.map((row) => row.payload), purchases: purchaseRows.map((row) => row.payload), approvals: approvalRows.map((row) => row.payload),
      ratings: ratingRows.map((row) => row.payload), auditEvents: auditRows.map((row) => row.payload), reputations: reputationRows.map((row) => row.payload)
    };
  }

  async getAgent(id: string): Promise<Agent | undefined> { return (await this.db.select().from(schema.agents).where(eq(schema.agents.id, id)).limit(1))[0]?.payload; }
  async getProvider(id: string): Promise<Provider | undefined> { return (await this.db.select().from(schema.providers).where(eq(schema.providers.id, id)).limit(1))[0]?.payload; }
  async getService(id: string): Promise<Service | undefined> { return (await this.db.select().from(schema.services).where(eq(schema.services.id, id)).limit(1))[0]?.payload; }
  async listServices(): Promise<Service[]> { await this.ensureSeeded(); return (await this.db.select().from(schema.services)).map((row) => row.payload); }
  async getPolicy(agentId: string): Promise<Policy | undefined> { return (await this.db.select().from(schema.policies).where(eq(schema.policies.agentId, agentId)).limit(1))[0]?.payload; }
  async getPurchase(id: string): Promise<Purchase | undefined> { return (await this.db.select().from(schema.purchases).where(eq(schema.purchases.id, id)).limit(1))[0]?.payload; }
  async listPurchases(): Promise<Purchase[]> { return (await this.db.select().from(schema.purchases)).map((row) => row.payload); }
  async getApprovalByPurchase(purchaseId: string): Promise<Approval | undefined> { return (await this.db.select().from(schema.approvals).where(eq(schema.approvals.purchaseId, purchaseId)).limit(1))[0]?.payload; }
  async getRatingByPurchase(purchaseId: string): Promise<Rating | undefined> { return (await this.db.select().from(schema.ratings).where(eq(schema.ratings.purchaseId, purchaseId)).limit(1))[0]?.payload; }
  async getReputation(subjectId: string, subjectType: SubjectType): Promise<ReputationSnapshot> {
    const row = (await this.db.select().from(schema.reputations).where(and(eq(schema.reputations.subjectId, subjectId), eq(schema.reputations.subjectType, subjectType))).limit(1))[0];
    return row?.payload ?? calculateReputation(subjectId, subjectType, emptyCounters());
  }

  async savePolicy(item: Policy): Promise<void> {
    await this.db.insert(schema.policies).values({ id: item.id, agentId: item.agentId, payload: item }).onConflictDoUpdate({ target: schema.policies.id, set: { payload: item, agentId: item.agentId, updatedAt: new Date() } });
  }
  async savePurchase(item: Purchase): Promise<void> {
    await this.db.insert(schema.purchases).values({ id: item.id, agentId: item.agentId, providerId: item.providerId, serviceId: item.serviceId, status: item.status, payload: item }).onConflictDoUpdate({ target: schema.purchases.id, set: { status: item.status, payload: item, updatedAt: new Date() } });
  }
  async saveApproval(item: Approval): Promise<void> {
    await this.db.insert(schema.approvals).values({ id: item.id, purchaseId: item.purchaseId, payload: item }).onConflictDoUpdate({ target: schema.approvals.id, set: { payload: item, updatedAt: new Date() } });
  }
  async saveRating(item: Rating): Promise<void> {
    await this.db.insert(schema.ratings).values({ id: item.id, purchaseId: item.purchaseId, providerId: item.providerId, agentId: item.agentId, payload: item }).onConflictDoUpdate({ target: schema.ratings.id, set: { payload: item, updatedAt: new Date() } });
  }
  async saveAuditEvent(item: AuditEvent): Promise<void> {
    await this.db.insert(schema.auditEvents).values({ id: item.id, purchaseId: item.purchaseId, type: item.type, payload: item }).onConflictDoNothing();
  }
  async saveReputation(item: ReputationSnapshot): Promise<void> {
    await this.db.insert(schema.reputations).values({ subjectId: item.subjectId, subjectType: item.subjectType, payload: item }).onConflictDoUpdate({ target: [schema.reputations.subjectId, schema.reputations.subjectType], set: { payload: item, updatedAt: new Date() } });
  }

  private async upsertAgent(item: Agent): Promise<void> { await this.db.insert(schema.agents).values({ id: item.id, payload: item }).onConflictDoNothing(); }
  private async upsertProvider(item: Provider): Promise<void> { await this.db.insert(schema.providers).values({ id: item.id, payload: item }).onConflictDoNothing(); }
  private async upsertService(item: Service): Promise<void> { await this.db.insert(schema.services).values({ id: item.id, providerId: item.providerId, payload: item }).onConflictDoNothing(); }
}
