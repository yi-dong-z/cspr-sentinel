import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { facilitatorConfigured, getFacilitator } from "@/lib/facilitator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_request: Request, context: { params: Promise<{ action: string }> }): Promise<Response> {
  const { action } = await context.params;
  if (action === "health") return Response.json({ status: facilitatorConfigured() ? "ok" : "unconfigured" }, { status: facilitatorConfigured() ? 200 : 503 });
  if (action !== "supported") return Response.json({ error: "not_found" }, { status: 404 });
  try {
    return Response.json((await getFacilitator()).getSupported());
  } catch {
    return Response.json({ error: "facilitator_unconfigured" }, { status: 503 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ action: string }> }): Promise<Response> {
  const { action } = await context.params;
  if (action !== "verify" && action !== "settle") return Response.json({ error: "not_found" }, { status: 404 });
  try {
    const body = await request.json() as { paymentPayload?: PaymentPayload; paymentRequirements?: PaymentRequirements };
    if (!body.paymentPayload || !body.paymentRequirements) {
      return Response.json({ error: "missing_payment_payload_or_requirements" }, { status: 400 });
    }
    const facilitator = await getFacilitator();
    const result = action === "verify"
      ? await facilitator.verify(body.paymentPayload, body.paymentRequirements)
      : await facilitator.settle(body.paymentPayload, body.paymentRequirements);
    return Response.json(result);
  } catch (error) {
    return Response.json({
      error: "facilitator_error",
      message: error instanceof Error ? error.message : "Unknown facilitator error."
    }, { status: facilitatorConfigured() ? 500 : 503 });
  }
}
