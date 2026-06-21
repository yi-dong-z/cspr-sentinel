import { z } from "zod";
import { buildDiligenceReport, createDiligencePlan } from "@cspr-sentinel/agent";
import { apiError } from "@/lib/http";
import { getEngine, getStore, runtimeMode } from "@/lib/runtime";
import { isAdminRequest } from "@/lib/auth";

const schema = z.object({
  instrumentId: z.string().min(3).max(80), issuer: z.string().min(2).max(100), faceValue: z.number().positive(),
  currency: z.string().length(3), maturityDate: z.string(), documentHash: z.string().min(8).max(128)
});

export async function POST(request: Request): Promise<Response> {
  if (runtimeMode() === "testnet" && !await isAdminRequest(request)) {
    return Response.json({ error: "unauthorized", message: "Owner authentication is required for real payments." }, { status: 401 });
  }
  try {
    const input = schema.parse(await request.json());
    const store = getStore();
    const services = await store.listServices();
    const plan = await createDiligencePlan(input, services);
    const purchases = [];
    for (const item of plan.purchases) {
      purchases.push(await getEngine().requestPurchase({
        agentId: "agent_rwa_analyst", serviceId: item.serviceId,
        payload: { instrument: input, rationale: item.rationale }, maxAmount: item.maxAmount
      }));
    }
    return Response.json({ plan, purchases, report: buildDiligenceReport(input, purchases) });
  } catch (error) { return apiError(error); }
}
