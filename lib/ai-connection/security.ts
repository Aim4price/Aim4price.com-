import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const READ_SCOPE = "aim4price:read";
export const ADMIN_READ_SCOPE = "aim4price:admin:read";
export type Audience = "owner" | "admin";
export type AiClient = {
  id: string;
  name: string;
  audience: Audience;
  secret: string;
  redirectUris: string[];
  origins: string[];
  launchUrl?: string;
};
export const connectionScope = (c: ConnectionConfig) =>
  c.audience === "admin" ? ADMIN_READ_SCOPE : READ_SCOPE;
export const connectionPage = (c: ConnectionConfig) =>
  c.audience === "admin" ? "/admin/ai-connect" : "/account/ai-connect";

export class ConnectionError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export type ConnectionConfig = {
  origin: string;
  resource: string;
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  allowedUserIds: string[];
  signingSecret: string;
  audience?: Audience;
  accessMode?: "pilot" | "owners";
  clients?: AiClient[];
  clientName?: string;
  allowedOrigins?: string[];
  sharedLimits?: boolean;
};
/** Registered clients only. Secrets stay server-side and are never returned to the browser. */
export function connectionConfig(
  env = process.env,
  audience: Audience = "owner",
): ConnectionConfig {
  if (
    env.AIM4PRICE_AI_ENABLED !== "true" ||
    (audience === "admin" && env.AIM4PRICE_AI_ADMIN_ENABLED !== "true")
  )
    throw new ConnectionError(
      503,
      "unavailable",
      "AI connections are not enabled yet.",
    );
  const origin = env.AIM4PRICE_AI_ORIGIN || "";
  const validHttps = (value: string, originOnly = false) => {
    try {
      const u = new URL(value);
      return (
        u.protocol === "https:" &&
        !u.hash &&
        !u.username &&
        !u.password &&
        (!originOnly || u.origin === value)
      );
    } catch {
      return false;
    }
  };
  if (!validHttps(origin, true))
    throw new Error("Configure an HTTPS AI origin.");
  const signingSecret = env.BETTER_AUTH_SECRET || "";
  if (signingSecret.length < 32)
    throw new Error("AI signing configuration is incomplete.");
  const split = (value = "") =>
    value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const clients: AiClient[] = [];
  const legacyId = env.AIM4PRICE_AI_CLIENT_ID;
  if (legacyId)
    clients.push({
      id: legacyId,
      name: "ChatGPT",
      audience: "owner",
      secret: env.AIM4PRICE_AI_CLIENT_SECRET || "",
      redirectUris: split(env.AIM4PRICE_AI_REDIRECT_URIS),
      origins: ["https://chatgpt.com"],
      launchUrl: "https://chatgpt.com/",
    });
  if (
    env.AIM4PRICE_AI_ADMIN_ENABLED === "true" &&
    env.AIM4PRICE_AI_ADMIN_CLIENT_ID
  )
    clients.push({
      id: env.AIM4PRICE_AI_ADMIN_CLIENT_ID,
      name: "ChatGPT Admin",
      audience: "admin",
      secret: env.AIM4PRICE_AI_ADMIN_CLIENT_SECRET || "",
      redirectUris: split(env.AIM4PRICE_AI_ADMIN_REDIRECT_URIS),
      origins: ["https://chatgpt.com"],
      launchUrl: "https://chatgpt.com/",
    });
  // Add providers without changing code. Each has independent credentials and exact callbacks.
  const registered: unknown = JSON.parse(env.AIM4PRICE_AI_CLIENTS_JSON || "[]");
  if (!Array.isArray(registered) || registered.length > 20)
    throw new Error("Invalid AI client registry.");
  for (const c of registered) {
    if (
      !c ||
      typeof c !== "object" ||
      !["owner", "admin"].includes(c.audience) ||
      typeof c.secretEnv !== "string" ||
      !/^AIM4PRICE_AI_[A-Z0-9_]+_SECRET$/.test(c.secretEnv)
    )
      throw new Error("Invalid AI client registration.");
    if (c.audience === "admin" && env.AIM4PRICE_AI_ADMIN_ENABLED !== "true")
      continue;
    clients.push({
      id: c.id,
      name: c.name,
      audience: c.audience,
      secret: env[c.secretEnv] || "",
      redirectUris: c.redirectUris,
      origins: c.origins || [],
      launchUrl: c.launchUrl,
    });
  }
  const ids = new Set<string>();
  for (const c of clients) {
    if (
      typeof c.id !== "string" ||
      !/^[a-zA-Z0-9._-]{1,120}$/.test(c.id) ||
      ids.has(c.id) ||
      typeof c.name !== "string" ||
      !c.name.trim() ||
      c.name.length > 80 ||
      c.secret.length < 32 ||
      !Array.isArray(c.redirectUris) ||
      !c.redirectUris.length ||
      c.redirectUris.some((u) => typeof u !== "string" || !validHttps(u)) ||
      !Array.isArray(c.origins) ||
      c.origins.some((u) => typeof u !== "string" || !validHttps(u, true)) ||
      (c.launchUrl && !validHttps(c.launchUrl))
    )
      throw new Error("Invalid or incomplete AI client configuration.");
    ids.add(c.id);
  }
  const first = clients.find((c) => c.audience === audience);
  if (!first)
    throw new ConnectionError(
      503,
      "unavailable",
      "No AI provider has been configured for this connection.",
    );
  const accessMode = env.AIM4PRICE_AI_ACCESS_MODE || "pilot";
  const allowedUserIds = split(env.AIM4PRICE_AI_ALLOWED_USER_IDS);
  if (
    !["pilot", "owners"].includes(accessMode) ||
    (audience === "owner" && accessMode === "pilot" && !allowedUserIds.length)
  )
    throw new Error("AI account access configuration is incomplete.");
  return {
    origin,
    resource:
      origin + (audience === "admin" ? "/api/ai/admin/mcp" : "/api/ai/mcp"),
    clientId: first.id,
    clientSecret: first.secret,
    clientName: first.name,
    redirectUris: first.redirectUris,
    allowedOrigins: first.origins,
    signingSecret,
    clients,
    audience,
    accessMode: accessMode as "pilot" | "owners",
    allowedUserIds,
    sharedLimits: env.AIM4PRICE_AI_SHARED_LIMITS === "true",
  };
}
export function selectClient(
  config: ConnectionConfig,
  id: string,
): ConnectionConfig {
  if (!config.clients) {
    if (id !== config.clientId)
      throw new ConnectionError(
        400,
        "invalid_client",
        "Unknown AI connection.",
      );
    return config;
  }
  const client = config.clients.find(
    (c) => c.id === id && c.audience === (config.audience || "owner"),
  );
  if (!client)
    throw new ConnectionError(400, "invalid_client", "Unknown AI connection.");
  return {
    ...config,
    clientId: client.id,
    clientSecret: client.secret,
    clientName: client.name,
    redirectUris: client.redirectUris,
    allowedOrigins: client.origins,
  };
}
export function authorizationConfig(
  params: URLSearchParams,
  base: ConnectionConfig,
): ConnectionConfig {
  const adminResource = base.origin + "/api/ai/admin/mcp";
  const config =
    params.get("resource") === adminResource
      ? connectionConfig(process.env, "admin")
      : base;
  return selectClient(config, params.get("client_id") || "");
}
export function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
export function opaqueToken(): string {
  return randomBytes(32).toString("base64url");
}
export function secureEqual(a: string, b: string): boolean {
  return timingSafeEqual(Buffer.from(digest(a)), Buffer.from(digest(b)));
}
export function pkce(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
export type Authorization = {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
  resource: string;
  scope: string;
};
export function authorizationRequest(
  params: URLSearchParams,
  config: ConnectionConfig,
): Authorization {
  for (const key of [
    "client_id",
    "redirect_uri",
    "state",
    "code_challenge",
    "resource",
    "scope",
    "response_type",
    "code_challenge_method",
  ]) {
    if (params.getAll(key).length !== 1)
      throw new ConnectionError(
        400,
        "invalid_request",
        "Incomplete or repeated connection parameter.",
      );
  }
  if (
    params.get("client_id") !== config.clientId ||
    !config.redirectUris.includes(params.get("redirect_uri") || "")
  )
    throw new ConnectionError(
      400,
      "invalid_client",
      "Unknown AI connection or return address.",
    );
  if (
    params.get("response_type") !== "code" ||
    params.get("code_challenge_method") !== "S256" ||
    !/^[A-Za-z0-9_-]{43}$/.test(params.get("code_challenge") || "")
  )
    throw new ConnectionError(
      400,
      "invalid_request",
      "This connection requires an S256 sign-in challenge.",
    );
  if (params.get("scope") !== connectionScope(config))
    throw new ConnectionError(
      400,
      "invalid_scope",
      "Only read-only access is supported.",
    );
  if (params.get("resource") !== config.resource)
    throw new ConnectionError(400, "invalid_target", "Incorrect API resource.");
  const state = params.get("state") || "";
  if (!state || state.length > 1024)
    throw new ConnectionError(
      400,
      "invalid_request",
      "Invalid connection state.",
    );
  return {
    clientId: config.clientId,
    redirectUri: params.get("redirect_uri")!,
    state,
    challenge: params.get("code_challenge")!,
    resource: config.resource,
    scope: connectionScope(config),
  };
}
export function consentProof(
  auth: Authorization,
  userId: string,
  sessionId: string,
  secret: string,
  now = Date.now(),
): string {
  const data = Buffer.from(
    JSON.stringify({ auth, userId, sessionId, expires: now + 5 * 60_000 }),
  ).toString("base64url");
  return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
}
export function verifyConsent(
  proof: string,
  userId: string,
  sessionId: string,
  config: ConnectionConfig,
  now = Date.now(),
): Authorization {
  const [data, mac, extra] = proof.split(".");
  if (
    !data ||
    !mac ||
    extra ||
    proof.length > 8192 ||
    !secureEqual(
      mac,
      createHmac("sha256", config.signingSecret)
        .update(data)
        .digest("base64url"),
    )
  )
    throw new ConnectionError(
      403,
      "invalid_request",
      "The connection approval expired. Start again.",
    );
  const payload = JSON.parse(Buffer.from(data, "base64url").toString());
  if (
    payload.userId !== userId ||
    payload.sessionId !== sessionId ||
    !Number.isFinite(payload.expires) ||
    payload.expires <= now
  )
    throw new ConnectionError(
      403,
      "invalid_request",
      "The connection approval expired. Start again.",
    );
  const a = payload.auth;
  return authorizationRequest(
    new URLSearchParams({
      client_id: a.clientId,
      redirect_uri: a.redirectUri,
      state: a.state,
      code_challenge: a.challenge,
      resource: a.resource,
      scope: a.scope,
      response_type: "code",
      code_challenge_method: "S256",
    }),
    config,
  );
}
export function requireSameOrigin(
  request: Request,
  config: ConnectionConfig,
): void {
  if (request.headers.get("origin") !== config.origin)
    throw new ConnectionError(
      403,
      "invalid_request",
      "Invalid request origin.",
    );
}
export async function limitedBody(
  request: Request,
  limit = 16384,
): Promise<string> {
  if (Number(request.headers.get("content-length")) > limit)
    throw new ConnectionError(413, "invalid_request", "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new ConnectionError(
          413,
          "invalid_request",
          "Request is too large.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}
export function json(
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Pragma: "no-cache",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}
export function errorResponse(error: unknown): Response {
  if (error instanceof ConnectionError)
    return json(
      { error: error.code, error_description: error.message },
      error.status,
      error.status === 429 ? { "Retry-After": "60" } : {},
    );
  // Never return SQL errors, credentials, connection parameters or raw request bodies.
  console.error("Aim4price AI connection failed.");
  return json(
    {
      error: "temporarily_unavailable",
      error_description:
        "The connection is temporarily unavailable. Please try again.",
    },
    503,
  );
}

/** Approval requires explicit acknowledgement; cancellation does not. */
export function requireConsentTerms(form: URLSearchParams): void {
  if (form.getAll("terms").length !== 1 || form.get("terms") !== "accepted")
    throw new ConnectionError(
      400,
      "consent_required",
      "Accept the terms and data-sharing notice before allowing access.",
    );
}

/** Resume only a validated OAuth request after website sign-in; never grants access. */
export function connectionSignInHref(
  params: URLSearchParams,
  config: ConnectionConfig,
): string {
  authorizationRequest(params, config);
  const returnTo = connectionPage(config) + "?" + params.toString();
  return (
    "/auth?accountAccess=desktop&returnTo=" +
    encodeURIComponent(returnTo) +
    "#login"
  );
}
