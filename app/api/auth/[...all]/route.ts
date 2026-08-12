import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "../../../../lib/auth";
import { withSignupWorkspaceInput } from "../../../../lib/signup-workspace-context";

export const runtime = "nodejs";

const authHandlers = toNextJsHandler(auth);

export const GET = authHandlers.GET;

export async function POST(request: Request): Promise<Response> {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, "");

  if (!pathname.endsWith("/sign-up/email")) {
    return authHandlers.POST(request);
  }

  const signupInput = await request.clone().json().catch(() => null);

  return withSignupWorkspaceInput(signupInput, () =>
    authHandlers.POST(request),
  );
}
