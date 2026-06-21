import { getStore, runtimeMode } from "@/lib/runtime";
import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const snapshot = await getStore().snapshot();
  return <Dashboard initialState={snapshot} initialMode={runtimeMode()} />;
}
