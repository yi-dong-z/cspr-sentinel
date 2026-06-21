import { z } from "zod";
import { getEngine } from "@/lib/runtime";
import { apiError } from "@/lib/http";
import { isAgentRequest } from "@/lib/auth";

const schema = z.object({
  agentId: z.string(), serviceId: z.string(), payload: z.record(z.string(), z.unknown()), maxAmount: z.number().positive()
});

export async function POST(request: Request): Promise<Response> {
  if (!isAgentRequest(request)) return Response.json({ error: "unauthorized", message: "Agent authentication is required." }, { status: 401 });
  try { return Response.json(await getEngine().requestPurchase(schema.parse(await request.json()))); }
  catch (error) { return apiError(error); }
}
