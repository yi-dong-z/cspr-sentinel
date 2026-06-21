import { handleMcpRequest } from "@cspr-sentinel/mcp";
import { getEngine, getStore } from "@/lib/runtime";
import { isAgentRequest } from "@/lib/auth";

const handler = (request: Request) => isAgentRequest(request)
  ? handleMcpRequest(request, getStore(), getEngine())
  : Response.json({ error: "unauthorized", message: "Agent authentication is required." }, { status: 401 });
export { handler as GET, handler as POST, handler as DELETE };
