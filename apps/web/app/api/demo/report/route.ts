import { z } from "zod";
import { buildDiligenceReport } from "@cspr-sentinel/agent";
import { apiError } from "@/lib/http";
import { getStore } from "@/lib/runtime";

const schema = z.object({
  instrumentId: z.string().min(3).max(80), issuer: z.string().min(2).max(100), faceValue: z.number().positive(),
  currency: z.string().length(3), maturityDate: z.string(), documentHash: z.string().min(8).max(128)
});

export async function POST(request: Request): Promise<Response> {
  try {
    const input = schema.parse(await request.json());
    const purchases = (await getStore().listPurchases())
      .filter((purchase) => {
        const instrument = purchase.requestPayload.instrument as { instrumentId?: string } | undefined;
        return purchase.agentId === "agent_rwa_analyst" && instrument?.instrumentId === input.instrumentId;
      })
      .slice(-2);
    return Response.json(buildDiligenceReport(input, purchases));
  } catch (error) { return apiError(error); }
}
