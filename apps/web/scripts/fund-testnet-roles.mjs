import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import sdk from "casper-js-sdk";

const { HttpHandler, KeyAlgorithm, NativeTransferBuilder, PrivateKey, PublicKey, RpcClient } = sdk;
const secrets = resolve(import.meta.dirname, "../../../.secrets/casper");
const publicKeys = JSON.parse(readFileSync(resolve(secrets, "public-keys.json"), "utf8"));
const sender = PrivateKey.fromPem(readFileSync(resolve(secrets, "agent.pem"), "utf8"), KeyAlgorithm.ED25519);
const rpc = new RpcClient(new HttpHandler(process.env.CASPER_RPC_URL ?? "https://node.testnet.casper.network/rpc", "fetch"));
const amount = process.env.CASPER_ROLE_FUNDING_MOTES ?? "100000000000";
const targets = ["facilitator", "reputation-operator"];

for (const [index, role] of targets.entries()) {
  const transaction = new NativeTransferBuilder()
    .from(sender.publicKey)
    .target(PublicKey.fromHex(publicKeys[role]))
    .amount(amount)
    .id(Date.now() + index)
    .chainName("casper-test")
    .payment(100_000_000)
    .build();
  transaction.sign(sender);
  const submitted = await rpc.putTransaction(transaction);
  console.log(`${role} funding submitted: ${submitted.transactionHash.toHex()}`);
  const result = await rpc.waitForTransaction(transaction, 180_000);
  const error = result.executionInfo?.executionResult?.errorMessage;
  if (error) throw new Error(`${role} funding failed: ${error}`);
  console.log(`${role} funding confirmed.`);
}
