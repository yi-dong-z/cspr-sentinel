import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sdk from "casper-js-sdk";

const {
  Args,
  CLValue,
  HttpHandler,
  Key,
  KeyAlgorithm,
  KeyTypeID,
  PrivateKey,
  RpcClient,
  SessionBuilder
} = sdk;

const root = resolve(import.meta.dirname, "../../..");
const secrets = resolve(root, ".secrets/casper");
const rpcUrl = process.env.CASPER_RPC_URL ?? "https://node.testnet.casper.network/rpc";
const wasmPath = resolve(root, "contracts/reputation/wasm/ReputationRegistry.wasm");
const outputDir = resolve(root, "resources");
const packageKeyName = process.env.REPUTATION_PACKAGE_KEY_NAME ?? "reputation_registry_package_hash";
const payment = Number(process.env.REPUTATION_DEPLOY_PAYMENT ?? "350000000000");

const operator = PrivateKey.fromPem(
  readFileSync(resolve(secrets, "reputation-operator.pem"), "utf8"),
  KeyAlgorithm.ED25519
);
const operatorAccountKey = Key.createByType(
  operator.publicKey.accountHash().toPrefixedString(),
  KeyTypeID.Account
);

const runtimeArgs = Args.fromMap({
  operator: CLValue.newCLKey(operatorAccountKey),
  odra_cfg_is_upgradable: CLValue.newCLValueBool(true),
  odra_cfg_is_upgrade: CLValue.newCLValueBool(false),
  odra_cfg_allow_key_override: CLValue.newCLValueBool(false),
  odra_cfg_package_hash_key_name: CLValue.newCLString(packageKeyName)
});

const transaction = new SessionBuilder()
  .from(operator.publicKey)
  .wasm(readFileSync(wasmPath))
  .installOrUpgrade()
  .runtimeArgs(runtimeArgs)
  .chainName("casper-test")
  .payment(payment)
  .build();

transaction.sign(operator);

const rpc = new RpcClient(new HttpHandler(rpcUrl, "fetch"));
const submitted = await rpc.putTransaction(transaction);
const transactionHash = submitted.transactionHash.toHex();
console.log(`reputation deploy submitted: ${transactionHash}`);

const result = await rpc.waitForTransaction(transaction, 240_000);
const error = result.executionInfo?.executionResult?.errorMessage;
if (error) throw new Error(`reputation deploy failed: ${error}`);
console.log("reputation deploy confirmed.");

let account;
for (let attempt = 0; attempt < 10; attempt += 1) {
  account = await rpc.getAccountInfo(null, { publicKey: operator.publicKey });
  const namedKeys = account.account?.namedKeys ?? account.account?.named_keys ?? [];
  if (namedKeys.some((entry) => entry.name === packageKeyName)) break;
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 3_000));
}

const namedKeys = account.account?.namedKeys ?? account.account?.named_keys ?? [];
const packageKey = namedKeys.find((entry) => entry.name === packageKeyName);
if (!packageKey) throw new Error(`Missing named key after deployment: ${packageKeyName}`);

const rawKey = packageKey.key ?? packageKey.value;
const contractPackageHash = String(rawKey)
  .replace(/^hash-/, "")
  .replace(/^package-/, "")
  .replace(/^contract-package-wasm/, "");

mkdirSync(outputDir, { recursive: true });
writeFileSync(
  resolve(outputDir, "reputation-deploy.json"),
  `${JSON.stringify({
    transactionHash,
    packageKeyName,
    contractPackageHash,
    operatorPublicKey: operator.publicKey.toHex(),
    namedKeys
  }, null, 2)}\n`
);
writeFileSync(
  resolve(outputDir, "testnet-contracts.toml"),
  `[reputation]\npackage_key_name = "${packageKeyName}"\npackage_hash = "${contractPackageHash}"\ndeploy_hash = "${transactionHash}"\n`
);

console.log(`reputation package hash: ${contractPackageHash}`);
