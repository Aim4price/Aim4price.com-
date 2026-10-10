import { redirect } from "next/navigation";
import { getDb } from "../../../lib/db";
import { connectionOwner } from "../../../lib/ai-connection/browser";
import {
  authorizationRequest,
  connectionSignInHref,
  connectionConfig,
  ConnectionError,
  consentProof,
  authorizationConfig,
  type Audience,
} from "../../../lib/ai-connection/security";
import ConnectionView from "./connection-view";
export async function renderAiConnectionPage(
  searchParams: Record<string, string | string[] | undefined> = {},
  audience: Audience = "owner",
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else if (value !== undefined) params.set(key, value);
  }
  try {
    const base = connectionConfig(process.env, audience);
    const config = params.size ? authorizationConfig(params, base) : base;
    if ((config.audience || "owner") !== audience)
      throw new ConnectionError(
        400,
        "invalid_target",
        "Use the correct connection page.",
      );
    const auth = params.size ? authorizationRequest(params, config) : null;
    const owner = await connectionOwner(config);
    const connections = (
      await getDb().query(
        `SELECT id,client_id,created_at,expires_at FROM public.ai_connections WHERE user_id=$1 AND resource=$2 AND revoked_at IS NULL AND expires_at>now() ORDER BY created_at DESC`,
        [owner.account.id, config.resource],
      )
    ).rows.map((c) => ({
      id: String(c.id),
      provider:
        config.clients?.find((client) => client.id === c.client_id)?.name ||
        "AI provider",
      disabled: !config.clients?.some((client) => client.id === c.client_id),
      created_at: new Date(c.created_at).toISOString(),
      expires_at: new Date(c.expires_at).toISOString(),
    }));
    return (
      <ConnectionView
        audience={audience}
        clientId={config.clientId}
        providerName={config.clientName}
        providers={config.clients
          ?.filter((c) => c.audience === audience)
          .map((c) => ({ name: c.name, launchUrl: c.launchUrl }))}
        account={owner.account}
        connections={connections}
        resource={config.resource}
        authorization={auth ? params.toString() : undefined}
        proof={
          auth
            ? consentProof(
                auth,
                owner.account.id,
                owner.sessionId,
                config.signingSecret,
              )
            : undefined
        }
      />
    );
  } catch (error) {
    if (error instanceof ConnectionError && error.status === 401) {
      if (params.size)
        redirect(
          connectionSignInHref(
            params,
            authorizationConfig(
              params,
              connectionConfig(process.env, audience),
            ),
          ),
        );
      const returnTo =
        audience === "admin" ? "/admin/ai-connect" : "/account/ai-connect";
      return (
        <ConnectionView
          audience={audience}
          signInHref={`/auth?accountAccess=desktop&returnTo=${encodeURIComponent(returnTo)}#login`}
        />
      );
    }
    const disabled =
      error instanceof ConnectionError && error.code === "unavailable";
    return (
      <ConnectionView
        audience={audience}
        needsVerification={
          audience === "admin" &&
          error instanceof ConnectionError &&
          error.code === "verification_required"
        }
        disabled={disabled}
        message={
          disabled
            ? "No AI provider is configured for this connection yet. You can review the available information below."
            : error instanceof ConnectionError
              ? error.message
              : "We couldn’t load your connection details. Please try again later."
        }
      />
    );
  }
}
