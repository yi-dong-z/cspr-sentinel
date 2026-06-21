import { jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { Agent, Approval, AuditEvent, Policy, Provider, Purchase, Rating, ReputationSnapshot, Service } from "../types";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
};

export const agents = pgTable("sentinel_agents", {
  id: text("id").primaryKey(),
  payload: jsonb("payload").$type<Agent>().notNull(),
  ...timestamps
});

export const providers = pgTable("sentinel_providers", {
  id: text("id").primaryKey(),
  payload: jsonb("payload").$type<Provider>().notNull(),
  ...timestamps
});

export const services = pgTable("sentinel_services", {
  id: text("id").primaryKey(),
  providerId: text("provider_id").notNull(),
  payload: jsonb("payload").$type<Service>().notNull(),
  ...timestamps
});

export const policies = pgTable("sentinel_policies", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  payload: jsonb("payload").$type<Policy>().notNull(),
  ...timestamps
}, (table) => [uniqueIndex("sentinel_policies_agent_idx").on(table.agentId)]);

export const purchases = pgTable("sentinel_purchases", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  providerId: text("provider_id").notNull(),
  serviceId: text("service_id").notNull(),
  status: text("status").notNull(),
  payload: jsonb("payload").$type<Purchase>().notNull(),
  ...timestamps
});

export const approvals = pgTable("sentinel_approvals", {
  id: text("id").primaryKey(),
  purchaseId: text("purchase_id").notNull(),
  payload: jsonb("payload").$type<Approval>().notNull(),
  ...timestamps
}, (table) => [uniqueIndex("sentinel_approvals_purchase_idx").on(table.purchaseId)]);

export const ratings = pgTable("sentinel_ratings", {
  id: text("id").primaryKey(),
  purchaseId: text("purchase_id").notNull(),
  providerId: text("provider_id").notNull(),
  agentId: text("agent_id").notNull(),
  payload: jsonb("payload").$type<Rating>().notNull(),
  ...timestamps
}, (table) => [uniqueIndex("sentinel_ratings_purchase_idx").on(table.purchaseId)]);

export const auditEvents = pgTable("sentinel_audit_events", {
  id: text("id").primaryKey(),
  purchaseId: text("purchase_id"),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<AuditEvent>().notNull(),
  ...timestamps
});

export const reputations = pgTable("sentinel_reputations", {
  subjectId: text("subject_id").notNull(),
  subjectType: text("subject_type").notNull(),
  payload: jsonb("payload").$type<ReputationSnapshot>().notNull(),
  ...timestamps
}, (table) => [primaryKey({ columns: [table.subjectId, table.subjectType] })]);
