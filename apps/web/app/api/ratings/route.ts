import { z } from "zod";
import { apiError } from "@/lib/http";
import { getEngine } from "@/lib/runtime";
import { isAdminRequest, isAgentRequest } from "@/lib/auth";

const schema = z.object({ purchaseId: z.string(), score: z.number().int().min(1).max(5), evidenceHash: z.string().min(8) });

export async function POST(request: Request): Promise<Response> {
  if (!isAgentRequest(request) && !await isAdminRequest(request)) return Response.json({ error: "unauthorized", message: "Agent or owner authentication is required." }, { status: 401 });
  try {
    const body = schema.parse(await request.json());
    return Response.json(await getEngine().submitProviderRating(body.purchaseId, body.score, body.evidenceHash));
  } catch (error) { return apiError(error); }
}
