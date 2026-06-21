import { protectProviderRequest } from "@/lib/x402";

export async function POST(request: Request): Promise<Response> {
  return protectProviderRequest(request, {
    price: 0.02,
    payee: process.env.ASSET_PROVIDER_PAYEE ?? "testnet-payee-atlas",
    name: "Asset Verification API"
  }, {
    source: "synthetic-fixture", issuerVerified: true, documentIntegrity: "matched",
    ownershipChain: "complete", maturityDate: "2027-03-31", flags: []
  });
}
