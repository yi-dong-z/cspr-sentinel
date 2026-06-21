import { NETWORK_CASPER_TESTNET, toFacilitatorCasperSigner } from "@make-software/casper-x402";
import { ExactCasperScheme } from "@make-software/casper-x402/exact/facilitator";
import { x402Facilitator } from "@x402/core/facilitator";
import { KeyAlgorithm, PrivateKey } from "casper-js-sdk";

type Facilitator = InstanceType<typeof x402Facilitator>;

declare global {
  var __csprSentinelFacilitator: Promise<Facilitator> | undefined;
}

export function facilitatorConfigured(): boolean {
  return Boolean(process.env.CASPER_FEE_PAYER_PRIVATE_KEY && process.env.CASPER_RPC_URL);
}

export function getFacilitator(): Promise<Facilitator> {
  if (!facilitatorConfigured()) throw new Error("Casper facilitator signer is not configured.");
  if (globalThis.__csprSentinelFacilitator) return globalThis.__csprSentinelFacilitator;
  globalThis.__csprSentinelFacilitator = (async () => {
    const algorithm = process.env.CASPER_FEE_PAYER_KEY_ALGORITHM?.toLowerCase() === "secp256k1"
      ? KeyAlgorithm.SECP256K1
      : KeyAlgorithm.ED25519;
    const key = PrivateKey.fromPem(
      process.env.CASPER_FEE_PAYER_PRIVATE_KEY!.replaceAll("\\n", "\n"),
      algorithm
    );
    const signer = await toFacilitatorCasperSigner(key, process.env.CASPER_RPC_URL!);
    const facilitator = new x402Facilitator();
    facilitator.register(NETWORK_CASPER_TESTNET, new ExactCasperScheme(signer, {
      limitedPaymentMotes: Number(process.env.CASPER_FACILITATOR_PAYMENT_MOTES ?? "7000000000")
    }));
    return facilitator;
  })();
  return globalThis.__csprSentinelFacilitator;
}
