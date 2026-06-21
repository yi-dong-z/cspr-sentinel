import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { getServerSession } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: process.env.GITHUB_ID && process.env.GITHUB_SECRET ? [GitHubProvider({
    clientId: process.env.GITHUB_ID,
    clientSecret: process.env.GITHUB_SECRET
  })] : [],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ profile }) {
      const owner = process.env.OWNER_GITHUB_LOGIN;
      if (!owner) return process.env.NODE_ENV !== "production";
      return (profile as { login?: string } | undefined)?.login?.toLowerCase() === owner.toLowerCase();
    }
  },
  pages: { signIn: "/" }
};

export async function isAdminRequest(request?: Request): Promise<boolean> {
  if (process.env.DEMO_MODE === "true") return true;
  const configuredKey = process.env.DEMO_ADMIN_KEY;
  const suppliedKey = request?.headers.get("x-demo-admin-key");
  if (configuredKey && suppliedKey && suppliedKey === configuredKey) return true;
  if (process.env.NODE_ENV !== "production" && process.env.DEMO_MODE !== "false") return true;
  const session = await getServerSession(authOptions);
  return Boolean(session?.user);
}

export function isAgentRequest(request: Request): boolean {
  if (process.env.DEMO_MODE === "true") return true;
  if (process.env.NODE_ENV !== "production" && process.env.DEMO_MODE !== "false") return true;
  const expected = process.env.AGENT_API_KEY;
  const supplied = request.headers.get("x-agent-api-key");
  return Boolean(expected && supplied && expected === supplied);
}
