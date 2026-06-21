import { z } from "zod";
import { isAdminRequest } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { getStore } from "@/lib/runtime";
import { touchPolicy } from "@cspr-sentinel/core";

const schema = z.object({ agentId: z.string(), autoApproveLimit: z.number().nonnegative(), dailyLimit: z.number().positive(), minimumProviderReputation: z.number().min(0).max(100) });

export async function PUT(request: Request): Promise<Response> {
  if (!await isAdminRequest(request)) return Response.json({ error: "unauthorized", message: "Owner authentication is required." }, { status: 401 });
  try {
    const body = schema.parse(await request.json());
    const store = getStore();
    const current = await store.getPolicy(body.agentId);
    if (!current) return Response.json({ error: "not_found", message: "Policy not found." }, { status: 404 });
    const updated = touchPolicy({ ...current, ...body });
    await store.savePolicy(updated);
    return Response.json(updated);
  } catch (error) { return apiError(error); }
}
