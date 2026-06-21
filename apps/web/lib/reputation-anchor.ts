import type { Purchase, Rating, ReputationAnchor, ReputationSnapshot } from "@cspr-sentinel/core";
import {
  Args,
  CLValue,
  ContractCallBuilder,
  HttpHandler,
  KeyAlgorithm,
  PrivateKey,
  RpcClient
} from "casper-js-sdk";

export function reputationAnchorConfigured(): boolean {
  return Boolean(
    process.env.REPUTATION_CONTRACT_HASH
    && process.env.REPUTATION_OPERATOR_PRIVATE_KEY
    && process.env.CASPER_RPC_URL
  );
}

export class CasperReputationAnchor implements ReputationAnchor {
  async anchor(purchase: Purchase, agent: ReputationSnapshot, provider: ReputationSnapshot): Promise<string> {
    const pem = process.env.REPUTATION_OPERATOR_PRIVATE_KEY;
    const contractHash = process.env.REPUTATION_CONTRACT_HASH;
    const rpcUrl = process.env.CASPER_RPC_URL;
    if (!pem || !contractHash || !rpcUrl || !purchase.deployHash) throw new Error("Reputation anchor is not configured.");

    const key = PrivateKey.fromPem(pem.replaceAll("\\n", "\n"), KeyAlgorithm.ED25519);
    const args = Args.fromMap({
      purchase_id: CLValue.newCLString(purchase.id),
      deploy_hash: CLValue.newCLString(purchase.deployHash),
      agent_id: CLValue.newCLString(agent.subjectId),
      provider_id: CLValue.newCLString(provider.subjectId),
      agent_payment_attempts: CLValue.newCLUint64(agent.counters.paymentAttempts),
      agent_payment_successes: CLValue.newCLUint64(agent.counters.paymentSuccesses),
      agent_policy_attempts: CLValue.newCLUint64(agent.counters.policyAttempts),
      agent_policy_compliant: CLValue.newCLUint64(agent.counters.policyCompliant),
      agent_approval_resolved: CLValue.newCLUint64(agent.counters.approvalResolved),
      agent_approval_approved: CLValue.newCLUint64(agent.counters.approvalApproved),
      provider_delivery_attempts: CLValue.newCLUint64(provider.counters.deliveryAttempts),
      provider_delivery_successes: CLValue.newCLUint64(provider.counters.deliverySuccesses),
      provider_rating_count: CLValue.newCLUint64(provider.counters.ratingCount),
      provider_rating_sum: CLValue.newCLUint64(provider.counters.ratingSum)
    });
    const transaction = new ContractCallBuilder()
      .byHash(contractHash.replace(/^contract-/, ""))
      .from(key.publicKey)
      .entryPoint("record_purchase")
      .chainName("casper-test")
      .payment(Number(process.env.REPUTATION_PAYMENT_AMOUNT ?? "3000000000"))
      .ttl(120_000)
      .runtimeArgs(args)
      .build();
    transaction.sign(key);
    const rpc = new RpcClient(new HttpHandler(rpcUrl, "fetch"));
    const result = await rpc.putTransaction(transaction);
    return result.transactionHash.toHex();
  }

  async anchorRating(purchase: Purchase, rating: Rating, provider: ReputationSnapshot): Promise<string> {
    const args = Args.fromMap({
      purchase_id: CLValue.newCLString(purchase.id),
      provider_id: CLValue.newCLString(provider.subjectId),
      score: CLValue.newCLUint8(rating.score),
      evidence_hash: CLValue.newCLString(rating.evidenceHash),
      provider_delivery_attempts: CLValue.newCLUint64(provider.counters.deliveryAttempts),
      provider_delivery_successes: CLValue.newCLUint64(provider.counters.deliverySuccesses),
      provider_rating_count: CLValue.newCLUint64(provider.counters.ratingCount),
      provider_rating_sum: CLValue.newCLUint64(provider.counters.ratingSum)
    });
    return this.submit("record_provider_rating", args);
  }

  private async submit(entryPoint: string, args: Args): Promise<string> {
    const pem = process.env.REPUTATION_OPERATOR_PRIVATE_KEY!;
    const key = PrivateKey.fromPem(pem.replaceAll("\\n", "\n"), KeyAlgorithm.ED25519);
    const transaction = new ContractCallBuilder()
      .byHash(process.env.REPUTATION_CONTRACT_HASH!.replace(/^contract-/, ""))
      .from(key.publicKey)
      .entryPoint(entryPoint)
      .chainName("casper-test")
      .payment(Number(process.env.REPUTATION_PAYMENT_AMOUNT ?? "3000000000"))
      .ttl(120_000)
      .runtimeArgs(args)
      .build();
    transaction.sign(key);
    const rpc = new RpcClient(new HttpHandler(process.env.CASPER_RPC_URL!, "fetch"));
    return (await rpc.putTransaction(transaction)).transactionHash.toHex();
  }
}
