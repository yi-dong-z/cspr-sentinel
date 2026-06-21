import { getStore, runtimeMode } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const mode = runtimeMode();
    const snapshot = await getStore().snapshot();
    const checks = {
      repository: snapshot.agents.length > 0 && snapshot.services.length > 0,
      persistence: process.env.DATABASE_URL ? "neon" : "memory",
      payments: mode === "testnet" ? "casper-testnet" : "simulated",
      reputation: mode === "testnet" ? "on-chain" : "simulated"
    };
    return Response.json({ status: "ok", mode, checks, timestamp: new Date().toISOString() });
  } catch {
    return Response.json({
      status: "misconfigured",
      mode: process.env.DEMO_MODE === "false" ? "testnet" : "simulated",
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}

