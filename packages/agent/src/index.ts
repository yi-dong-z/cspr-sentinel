import Anthropic from "@anthropic-ai/sdk";
import type { Purchase, Service } from "@cspr-sentinel/core";
import { z } from "zod";

const planSchema = z.object({
  summary: z.string(),
  purchases: z.array(z.object({
    serviceId: z.string(),
    rationale: z.string(),
    maxAmount: z.number().positive()
  }))
});

export type DiligencePlan = z.infer<typeof planSchema>;

export interface CommercialPaperInput {
  instrumentId: string;
  issuer: string;
  faceValue: number;
  currency: string;
  maturityDate: string;
  documentHash: string;
}

const systemPrompt = `You are an RWA due diligence agent. Decide which paid services are necessary to assess a tokenized commercial paper instrument. Use only services supplied by the caller. Return concise, factual reasoning. All provider results are synthetic demonstration data and must never be described as real-world verification.`;

export async function createDiligencePlan(input: CommercialPaperInput, services: Service[]): Promise<DiligencePlan> {
  if (!process.env.ANTHROPIC_API_KEY) return deterministicPlan(services);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
    max_tokens: 700,
    system: systemPrompt,
    messages: [{ role: "user", content: JSON.stringify({ instrument: input, availableServices: services }) }],
    tools: [{
      name: "submit_diligence_plan",
      description: "Submit the final paid-service purchase plan.",
      input_schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          purchases: {
            type: "array",
            items: {
              type: "object",
              properties: {
                serviceId: { type: "string" },
                rationale: { type: "string" },
                maxAmount: { type: "number" }
              },
              required: ["serviceId", "rationale", "maxAmount"]
            }
          }
        },
        required: ["summary", "purchases"]
      }
    }],
    tool_choice: { type: "tool", name: "submit_diligence_plan" }
  });
  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return deterministicPlan(services);
  return planSchema.parse(toolUse.input);
}

export function buildDiligenceReport(input: CommercialPaperInput, purchases: Purchase[]): Record<string, unknown> {
  const verification = purchases.find((purchase) => purchase.serviceId === "service_asset_verification")?.responsePayload;
  const risk = purchases.find((purchase) => purchase.serviceId === "service_risk_intelligence")?.responsePayload;
  const complete = Boolean(verification && risk);
  return {
    title: `Synthetic due diligence report for ${input.instrumentId}`,
    disclaimer: "Demonstration only. Provider data is synthetic and is not investment, legal, or compliance advice.",
    instrument: input,
    status: complete ? "complete" : "awaiting-paid-intelligence",
    verification: verification ?? null,
    risk: risk ?? null,
    conclusion: complete
      ? "Document integrity checks passed. Counterparty concentration requires human review before any investment decision."
      : "The report remains incomplete until all approved paid services have delivered results.",
    evidence: purchases.map((purchase) => ({ serviceId: purchase.serviceId, deployHash: purchase.deployHash, mode: purchase.chainMode }))
  };
}

function deterministicPlan(services: Service[]): DiligencePlan {
  return {
    summary: "Verify the instrument record first, then obtain counterparty and concentration risk intelligence.",
    purchases: services.map((service) => ({
      serviceId: service.id,
      rationale: service.category === "asset-verification"
        ? "Validate document integrity, issuer identity, and ownership chain."
        : "Assess counterparty, jurisdiction, and concentration risk before a final conclusion.",
      maxAmount: service.price
    }))
  };
}
