import { BillingError, validateSignupBilling } from "../../../../lib/billing";
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

  try {
    const billingSignup = await validateSignupBilling(signupInput ?? {});
    return await withSignupWorkspaceInput({ ...signupInput, billingSignup }, () => authHandlers.POST(request));
  } catch (error) {
    if (error instanceof BillingError) return Response.json({ message: error.message }, { status: 400 });
    console.error("Signup billing preparation failed", error);
    return Response.json({ message: "Account setup could not finish. Please retry or contact Aim4price." }, { status: 503 });
  }
}
