import { z } from "zod";
import { isAdminRequest } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { getEngine } from "@/lib/runtime";

const schema = z.object({ decision: z.enum(["approved", "rejected"]), reason: z.string().max(240).optional() });

export async function POST(request: Request, context: { params: Promise<{ purchaseId: string }> }): Promise<Response> {
  if (!await isAdminRequest(request)) return Response.json({ error: "unauthorized", message: "Owner authentication is required." }, { status: 401 });
  try {
    const { purchaseId } = await context.params;
    const body = schema.parse(await request.json());
    return Response.json(await getEngine().resolveApproval(purchaseId, body.decision, "workspace-owner", body.reason));
  } catch (error) { return apiError(error); }
}
