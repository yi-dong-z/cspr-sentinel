import { getStore, runtimeMode } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const git = {
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null
  };
  try {
    const mode = runtimeMode();
    const snapshot = await getStore().snapshot();
    const checks = {
      repository: snapshot.agents.length > 0 && snapshot.services.length > 0,
      persistence: process.env.DATABASE_URL ? "neon" : "memory",
      payments: mode === "testnet" ? "casper-testnet" : "simulated",
      reputation: mode === "testnet" ? "on-chain" : "simulated"
    };
    return Response.json({ status: "ok", mode, checks, git, timestamp: new Date().toISOString() });
  } catch {
    return Response.json({
      status: "misconfigured",
      mode: process.env.DEMO_MODE === "false" ? "testnet" : "simulated",
      git,
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}
