import { NETWORK_CASPER_TESTNET, toClientCasperSigner } from "@make-software/casper-x402";
import { ExactCasperScheme } from "@make-software/casper-x402/exact/client";
import { registerExactCasperScheme } from "@make-software/casper-x402/exact/server";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { HTTPFacilitatorClient, x402HTTPResourceServer, x402ResourceServer, type HTTPAdapter } from "@x402/core/server";
import type { PaymentAdapter, Purchase, Service, SettlementResult } from "@cspr-sentinel/core";
import { KeyAlgorithm, PrivateKey } from "casper-js-sdk";

const JSON_HEADERS = { "content-type": "application/json", accept: "application/json" };

export function x402Configured(): boolean {
  return Boolean(
    process.env.CASPER_AGENT_PRIVATE_KEY
    && process.env.CASPER_FACILITATOR_URL
    && process.env.WCSPR_CONTRACT_PACKAGE_HASH
    && process.env.NEXT_PUBLIC_APP_URL
  );
}

export class CasperX402PaymentAdapter implements PaymentAdapter {
  async settle(purchase: Purchase, service: Service): Promise<SettlementResult> {
    const pem = process.env.CASPER_AGENT_PRIVATE_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!pem || !appUrl) throw new Error("Casper agent signer is not configured.");
    const privateKey = PrivateKey.fromPem(pem.replaceAll("\\n", "\n"), KeyAlgorithm.ED25519);
    const scheme = new ExactCasperScheme(toClientCasperSigner(privateKey));
    const client = new x402HTTPClient(new x402Client().register(NETWORK_CASPER_TESTNET, scheme));
    const url = new URL(service.endpoint, appUrl);
    const body = JSON.stringify(purchase.requestPayload);
    const initial = await fetch(url, { method: "POST", headers: JSON_HEADERS, body, cache: "no-store" });
    if (initial.status !== 402) throw new Error(`Paid endpoint returned ${initial.status} instead of 402.`);
    const unpaidBody = await initial.clone().json().catch(() => ({}));
    const required = client.getPaymentRequiredResponse((name) => initial.headers.get(name), unpaidBody);
    const payload = await client.createPaymentPayload(required);
    const paymentHeaders = client.encodePaymentSignatureHeader(payload);
    const paid = await fetch(url, { method: "POST", headers: { ...JSON_HEADERS, ...paymentHeaders }, body, cache: "no-store" });
    if (!paid.ok) throw new Error(`x402 settlement failed with HTTP ${paid.status}.`);
    const settlement = client.getPaymentSettleResponse((name) => paid.headers.get(name));
    if (!settlement.success) throw new Error(settlement.errorMessage ?? settlement.errorReason ?? "Facilitator rejected payment.");
    return { deployHash: settlement.transaction, response: await paid.json() as Record<string, unknown>, chainMode: "testnet" };
  }
}

export async function protectProviderRequest(
  request: Request,
  config: { price: number; payee: string; name: string },
  payload: Record<string, unknown>
): Promise<Response> {
  if (!x402Configured()) return Response.json({ ...payload, paymentMode: "simulated-provider" });
  const facilitator = new HTTPFacilitatorClient({ url: process.env.CASPER_FACILITATOR_URL! });
  const core = registerExactCasperScheme(new x402ResourceServer(facilitator), { networks: [NETWORK_CASPER_TESTNET] });
  const decimals = Number(process.env.WCSPR_DECIMALS ?? "9");
  const amount = BigInt(Math.round(config.price * 10 ** decimals)).toString();
  const path = new URL(request.url).pathname;
  const server = new x402HTTPResourceServer(core, {
    [`POST ${path}`]: {
      accepts: {
        scheme: "exact",
        network: NETWORK_CASPER_TESTNET,
        payTo: config.payee,
        price: { asset: process.env.WCSPR_CONTRACT_PACKAGE_HASH!, amount },
        maxTimeoutSeconds: 120
      },
      description: config.name,
      mimeType: "application/json",
      unpaidResponseBody: async () => ({ contentType: "application/json", body: { error: "payment_required", service: config.name } })
    }
  });
  await server.initialize();
  const adapter = createRequestAdapter(request);
  const paymentHeader = request.headers.get("payment-signature") ?? request.headers.get("x-payment");
  const context = { adapter, path, method: request.method, ...(paymentHeader ? { paymentHeader } : {}) };
  const result = await server.processHTTPRequest(context);
  if (result.type === "payment-error") {
    return new Response(JSON.stringify(result.response.body ?? {}), { status: result.response.status, headers: result.response.headers });
  }
  if (result.type !== "payment-verified") return Response.json(payload);
  const body = JSON.stringify(payload);
  const settlement = await server.processSettlement(result.paymentPayload, result.paymentRequirements, result.declaredExtensions, {
    request: context,
    responseBody: Buffer.from(body),
    responseHeaders: { "content-type": "application/json" }
  });
  if (!settlement.success) return new Response(JSON.stringify({ error: settlement.errorReason }), { status: 402, headers: settlement.headers });
  return new Response(body, { status: 200, headers: { "content-type": "application/json", ...settlement.headers } });
}

function createRequestAdapter(request: Request): HTTPAdapter {
  const url = new URL(request.url);
  return {
    getHeader: (name) => request.headers.get(name) ?? undefined,
    getMethod: () => request.method,
    getPath: () => url.pathname,
    getUrl: () => request.url,
    getAcceptHeader: () => request.headers.get("accept") ?? "application/json",
    getUserAgent: () => request.headers.get("user-agent") ?? "cspr-sentinel",
    getQueryParams: () => Object.fromEntries(url.searchParams.entries())
  };
}
