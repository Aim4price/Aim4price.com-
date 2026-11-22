import { isMiddlemanAccountSubtype } from "../../../../lib/middleman-account";
import { isSupportedSignupAccountType } from "../../../../lib/retired-workspaces";
import { BillingError, validateSignupBilling } from "../../../../lib/billing";
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "../../../../lib/auth";
import { withSignupWorkspaceInput } from "../../../../lib/signup-workspace-context";

export const runtime = "nodejs";

const authHandlers = toNextJsHandler(auth);

export const GET = authHandlers.GET;

export async function POST(request: Request): Promise<Response> {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, "");

  if (pathname.endsWith("/change-email")) {
    const input = await request.clone().json().catch(() => null);
    if (input?.confirmation !== 'CHANGE EMAIL') {
      return Response.json({ message: 'Type CHANGE EMAIL to confirm.' }, { status: 400 });
    }
  }

  if (!pathname.endsWith("/sign-up/email")) {
    return authHandlers.POST(request);
  }

  const signupInput = await request.clone().json().catch(() => null);

  try {
    if (!isSupportedSignupAccountType(signupInput?.accountType) || isMiddlemanAccountSubtype(signupInput?.accountSubtype)) {
      return Response.json({ message: 'Choose an Owner or Business account.' }, { status: 400 });
    }
    const publicType = String(signupInput?.accountType ?? 'owner').trim().toLowerCase();
    const choice = signupInput?.signupPlan;
    if (choice != null && !['free','paid'].includes(choice)) return Response.json({message:'Choose a signup plan.'},{status:400});
    const ownerTrial = publicType === 'owner' && choice === 'free';
    const accountType = publicType === 'business' && choice === 'paid' ? 'dealer' : publicType;
    if (publicType === 'business' && (typeof signupInput.businessName !== 'string' || !signupInput.businessName.trim() || signupInput.businessName.length > 200 || signupInput.acceptedTerms !== true)) {
      return Response.json({ message: 'Enter your business name and accept the terms.' }, { status: 400 });
    }
    const accountAccess = ownerTrial ? 'trial' : accountType === 'business' || (choice == null && signupInput?.accountAccess === 'free') ? 'free' : 'desktop';
    if (accountAccess === 'free' && accountType !== 'business') {
      return Response.json({message:'Free sharing is available for Business accounts only.'},{status:400});
    }
    const billingSignup = accountAccess !== 'desktop' ? null : await validateSignupBilling({ ...signupInput, accountType });
    if (choice === 'paid' && !billingSignup) throw new BillingError('This paid plan is unavailable. Refresh to review the available plans.');
    return await withSignupWorkspaceInput({ ...signupInput, accountType, accountAccess, billingSignup }, () => authHandlers.POST(request));
  } catch (error) {
    if (error instanceof BillingError) return Response.json({ message: error.message }, { status: 400 });
    console.error("Signup billing preparation failed", error);
    return Response.json({ message: "Account setup could not finish. Please retry or contact Aim4price." }, { status: 503 });
  }
}
