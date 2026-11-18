import { AsyncLocalStorage } from "node:async_hooks";

type SetupRequest = { email: string; url?: string };
const setupRequest = new AsyncLocalStorage<SetupRequest>();

// Auth generates and persists its normal single-use token. Admin awaits delivery
// separately because the auth library handles mail callback errors internally.
export function captureSetupLink(email: string, url: string) {
  const request = setupRequest.getStore();
  if (!request || request.email !== email) return false;
  request.url = url;
  return true;
}

export async function sendSetupInvitation(email: string, generate: () => Promise<unknown>, deliver: (url: string) => Promise<void>) {
  const request: SetupRequest = { email };
  await setupRequest.run(request, generate);
  if (!request.url) throw new Error("Unable to prepare the setup email. Please retry.");
  await deliver(request.url);
}
