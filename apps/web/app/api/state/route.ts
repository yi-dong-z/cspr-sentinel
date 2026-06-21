import { getStore, runtimeMode } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json({ ...(await getStore().snapshot()), runtimeMode: runtimeMode() });
}
