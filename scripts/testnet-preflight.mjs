import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requestedEnv = process.argv.find((value) => value.startsWith("--env="))?.slice(6);
const envFile = resolve(root, requestedEnv || "apps/web/.env.local");

if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

const checks = [];
const add = (name, ok, detail) => checks.push({ name, ok, detail });
const present = (name) => Boolean(process.env[name] && !process.env[name].includes("replace-with"));

const required = [
  "DATABASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "DEMO_ADMIN_KEY",
  "AGENT_API_KEY",
  "GITHUB_ID",
  "GITHUB_SECRET",
  "NEXTAUTH_SECRET",
  "OWNER_GITHUB_LOGIN",
  "CASPER_RPC_URL",
  "CASPER_AGENT_PRIVATE_KEY",
  "CASPER_FEE_PAYER_PRIVATE_KEY",
  "CASPER_FACILITATOR_URL",
  "WCSPR_CONTRACT_PACKAGE_HASH",
  "ASSET_PROVIDER_PAYEE",
  "RISK_PROVIDER_PAYEE",
  "REPUTATION_CONTRACT_HASH",
  "REPUTATION_OPERATOR_PRIVATE_KEY"
];

add("real mode", process.env.DEMO_MODE === "false", "DEMO_MODE must equal false");
add("Casper network", process.env.CASPER_NETWORK === "casper:casper-test", "expected casper:casper-test");
for (const name of required) add(name, present(name), present(name) ? "configured" : "missing");

for (const name of ["DEMO_ADMIN_KEY", "AGENT_API_KEY", "NEXTAUTH_SECRET"]) {
  if (present(name)) add(`${name} strength`, process.env[name].length >= 32, "minimum 32 characters");
}

for (const name of ["CASPER_AGENT_PRIVATE_KEY", "CASPER_FEE_PAYER_PRIVATE_KEY", "REPUTATION_OPERATOR_PRIVATE_KEY"]) {
  if (present(name)) {
    const pem = process.env[name].replaceAll("\\n", "\n");
    add(`${name} format`, /-----BEGIN (?:EC )?PRIVATE KEY-----[\s\S]+-----END (?:EC )?PRIVATE KEY-----/.test(pem), "PEM private key");
  }
}

if (present("WCSPR_CONTRACT_PACKAGE_HASH")) {
  add("WCSPR package hash", /^(?:hash-)?[0-9a-f]{64}$/i.test(process.env.WCSPR_CONTRACT_PACKAGE_HASH), "64-byte hex package hash");
}
if (present("REPUTATION_CONTRACT_HASH")) {
  add("reputation contract hash", /^(?:contract-)?[0-9a-f]{64}$/i.test(process.env.REPUTATION_CONTRACT_HASH), "64-byte hex contract hash");
}
for (const name of ["ASSET_PROVIDER_PAYEE", "RISK_PROVIDER_PAYEE"]) {
  if (present(name)) add(`${name} format`, /^(?:account-hash-)?[0-9a-f]{64,66}$/i.test(process.env[name]), "Casper account address");
}

async function probe(name, action) {
  try {
    const detail = await action();
    add(name, true, detail);
  } catch (error) {
    add(name, false, error instanceof Error ? error.message : String(error));
  }
}

if (present("CASPER_RPC_URL")) {
  await probe("Casper RPC", async () => {
    const response = await fetch(process.env.CASPER_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "info_get_status", params: [] }),
      signal: AbortSignal.timeout(10_000)
    });
    const body = await response.json();
    if (!response.ok || body.error) throw new Error(body.error?.message || `HTTP ${response.status}`);
    return body.result?.chainspec_name || "reachable";
  });
}

if (present("CASPER_FACILITATOR_URL")) {
  await probe("x402 facilitator", async () => {
    const response = await fetch(new URL("/supported", process.env.CASPER_FACILITATOR_URL), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000)
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!text.includes("casper:casper-test") || !text.includes("exact")) throw new Error("exact/casper:casper-test not advertised");
    return "exact on casper:casper-test";
  });
}

console.log(`CSPR Sentinel Testnet Preflight${existsSync(envFile) ? ` (${envFile})` : ""}\n`);
for (const check of checks) console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.name}: ${check.detail}`);
const failures = checks.filter((check) => !check.ok).length;
console.log(`\n${failures ? `${failures} check(s) failed.` : "All checks passed. Ready for a funded smoke payment."}`);
process.exitCode = failures ? 1 : 0;
