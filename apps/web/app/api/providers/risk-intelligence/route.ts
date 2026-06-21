import { protectProviderRequest } from "@/lib/x402";

export async function POST(request: Request): Promise<Response> {
  return protectProviderRequest(request, {
    price: 0.12,
    payee: process.env.RISK_PROVIDER_PAYEE ?? "testnet-payee-meridian",
    name: "Risk Intelligence API"
  }, {
    source: "synthetic-fixture", counterpartyRisk: "moderate", jurisdictionRisk: "low",
    concentrationRisk: "elevated", watchlistMatches: 0,
    explanation: "Exposure is concentrated in one logistics counterparty. No synthetic watchlist matches were found."
  });
}
