import { isSupportedSignupAccountType, isRetiredAssistanceAccount } from "../../../../lib/retired-workspaces";
import { BillingError, validateSignupBilling } from "../../../../lib/billing";
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "../../../../lib/auth";
import { withSignupWorkspaceInput } from "../../../../lib/signup-workspace-context";

export const runtime = "nodejs";

const authHandlers = toNextJsHandler(auth);

export const GET = authHandlers.GET;

export async function POST(request: Request): Promise<Response> {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, "");

  if (pathname.endsWith("/sign-in/email")) {
    const input = await request.clone().json().catch(() => null);
    if (isRetiredAssistanceAccount({ email: input?.email })) {
      return Response.json({ message: 'This assistance account has been retired.' }, { status: 403 });
    }
  }

  if (!pathname.endsWith("/sign-up/email")) {
    return authHandlers.POST(request);
  }

  const signupInput = await request.clone().json().catch(() => null);

  try {
    if (!isSupportedSignupAccountType(signupInput?.accountType) || isRetiredAssistanceAccount({ email: signupInput?.email })) {
      return Response.json({ message: 'Choose an Owner, Dealer, Business or Middleman account.' }, { status: 400 });
    }
    const accountType = String(signupInput?.accountType ?? 'owner').trim().toLowerCase();
    if (accountType === 'business' && (typeof signupInput.businessName !== 'string' || !signupInput.businessName.trim() || signupInput.businessName.length > 200 || signupInput.acceptedTerms !== true)) {
      return Response.json({ message: 'Enter your business name and accept the terms.' }, { status: 400 });
    }
    const billingSignup = await validateSignupBilling(signupInput ?? {});
    return await withSignupWorkspaceInput({ ...signupInput, accountType, billingSignup }, () => authHandlers.POST(request));
  } catch (error) {
    if (error instanceof BillingError) return Response.json({ message: error.message }, { status: 400 });
    console.error("Signup billing preparation failed", error);
    return Response.json({ message: "Account setup could not finish. Please retry or contact Aim4price." }, { status: 503 });
  }
}
