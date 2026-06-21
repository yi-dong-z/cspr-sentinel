import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sdk from "casper-js-sdk";

const { KeyAlgorithm, PrivateKey } = sdk;
const output = resolve(import.meta.dirname, "../../../.secrets/casper");
const roles = ["agent", "facilitator", "reputation-operator", "provider-asset", "provider-risk"];

mkdirSync(output, { recursive: true, mode: 0o700 });
const publicFile = resolve(output, "public-keys.json");
const publicKeys = existsSync(publicFile)
  ? JSON.parse(readFileSync(publicFile, "utf8"))
  : {};
let created = 0;
for (const role of roles) {
  if (existsSync(resolve(output, `${role}.pem`))) continue;
  const key = PrivateKey.generate(KeyAlgorithm.ED25519);
  writeFileSync(resolve(output, `${role}.pem`), key.toPem(), { mode: 0o600 });
  publicKeys[role] = key.publicKey.toHex();
  created += 1;
}
if (!created) throw new Error(`All wallet files already exist in ${output}; refusing to overwrite them.`);
writeFileSync(publicFile, `${JSON.stringify(publicKeys, null, 2)}\n`, { mode: 0o600 });

console.log("Casper Testnet wallets created. Fund these public keys with test CSPR:");
for (const [role, publicKey] of Object.entries(publicKeys)) console.log(`${role}: ${publicKey}`);
console.log(`Private PEM files are stored with mode 600 under ${output}.`);
