import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { SentinelEngine, SentinelStore, SubjectType } from "@cspr-sentinel/core";
import { z } from "zod";

const asToolResult = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  structuredContent: value as Record<string, unknown>
});

export function createSentinelMcpServer(store: SentinelStore, engine: SentinelEngine): McpServer {
  const server = new McpServer({ name: "cspr-sentinel", version: "0.1.0" });

  server.registerTool("list_services", {
    title: "List paid services",
    description: "List x402 services that satisfy category, price, and provider reputation constraints.",
    inputSchema: {
      category: z.enum(["asset-verification", "risk-intelligence"]).optional(),
      max_price: z.number().positive().optional(),
      min_reputation: z.number().min(0).max(100).optional()
    }
  }, async ({ category, max_price, min_reputation }) => {
    const services = await store.listServices();
    const enriched = await Promise.all(services.map(async (service) => ({
      ...service,
      providerReputation: await store.getReputation(service.providerId, "provider")
    })));
    return asToolResult(enriched.filter((service) =>
      (!category || service.category === category)
      && (!max_price || service.price <= max_price)
      && (!min_reputation || service.providerReputation.score >= min_reputation)
    ));
  });

  server.registerTool("request_purchase", {
    title: "Request a policy-controlled purchase",
    description: "Request an x402 purchase. Policy-compliant small payments settle automatically; larger payments wait for owner approval.",
    inputSchema: {
      agent_id: z.string(),
      service_id: z.string(),
      payload: z.record(z.string(), z.unknown()),
      max_amount: z.number().positive()
    }
  }, async ({ agent_id, service_id, payload, max_amount }) => asToolResult(await engine.requestPurchase({ agentId: agent_id, serviceId: service_id, payload, maxAmount: max_amount })));

  server.registerTool("get_purchase_status", {
    title: "Get purchase status",
    description: "Return payment, approval, delivery, and chain evidence for a purchase.",
    inputSchema: { purchase_id: z.string() }
  }, async ({ purchase_id }) => {
    const purchase = await store.getPurchase(purchase_id);
    if (!purchase) return { content: [{ type: "text" as const, text: "Purchase not found." }], isError: true };
    const approval = await store.getApprovalByPurchase(purchase_id);
    return asToolResult({ purchase, approval });
  });

  server.registerTool("submit_provider_rating", {
    title: "Submit verified provider rating",
    description: "Rate a provider after a delivered, settled purchase. Each purchase can be rated once.",
    inputSchema: { purchase_id: z.string(), score: z.number().int().min(1).max(5), evidence_hash: z.string().min(8) }
  }, async ({ purchase_id, score, evidence_hash }) => asToolResult(await engine.submitProviderRating(purchase_id, score, evidence_hash)));

  server.registerTool("get_reputation", {
    title: "Get bilateral reputation",
    description: "Read the score, label, counters, and latest chain anchor for an agent or provider.",
    inputSchema: { subject_id: z.string(), subject_type: z.enum(["agent", "provider"]) }
  }, async ({ subject_id, subject_type }) => asToolResult(await store.getReputation(subject_id, subject_type as SubjectType)));

  return server;
}

export async function handleMcpRequest(request: Request, store: SentinelStore, engine: SentinelEngine): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport();
  const server = createSentinelMcpServer(store, engine);
  await server.connect(transport);
  return transport.handleRequest(request);
}
