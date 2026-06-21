CREATE TABLE "sentinel_agents" (
	"id" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sentinel_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"purchase_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sentinel_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"purchase_id" text,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sentinel_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sentinel_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sentinel_purchases" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"service_id" text NOT NULL,
	"status" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sentinel_ratings" (
	"id" text PRIMARY KEY NOT NULL,
	"purchase_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sentinel_reputations" (
	"subject_id" text NOT NULL,
	"subject_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sentinel_reputations_subject_id_subject_type_pk" PRIMARY KEY("subject_id","subject_type")
);
--> statement-breakpoint
CREATE TABLE "sentinel_services" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sentinel_approvals_purchase_idx" ON "sentinel_approvals" USING btree ("purchase_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sentinel_policies_agent_idx" ON "sentinel_policies" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sentinel_ratings_purchase_idx" ON "sentinel_ratings" USING btree ("purchase_id");