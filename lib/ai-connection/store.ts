import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { isAim4priceAdminEmail } from "../account-constants";
import {
  ConnectionError,
  digest,
  opaqueToken,
  pkce,
  connectionScope,
  selectClient,
  secureEqual,
  type Authorization,
  type ConnectionConfig,
} from "./security";
export type ConnectionDb = Pick<Pool, "connect" | "query">;
export type Reader = Pick<PoolClient, "query">;
export async function readOnly<T>(
  pool: ConnectionDb,
  fn: (db: Reader) => Promise<T>,
): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query(
      "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    await db.query("SET LOCAL statement_timeout = '8000ms'");
    const result = await fn(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
export async function eligibleAccount(
  db: Reader,
  userId: string,
  config: ConnectionConfig,
) {
  if (config.audience === "admin") {
    const row = (
      await db.query(
        `SELECT u.id,u.name,u.email,to_jsonb(u)->>'emailVerified' AS verified,
      p.account_status FROM public."user" u LEFT JOIN public.account_profiles p ON p.user_id=u.id WHERE u.id=$1`,
        [userId],
      )
    ).rows[0];
    if (
      !row ||
      userId.startsWith("aim4price-assistance-") ||
      !isAim4priceAdminEmail(row.email) ||
      row.account_status === "suspended"
    )
      throw new ConnectionError(
        403,
        "access_denied",
        "An Aim4price administrator account is required.",
      );
    if (row.verified !== "true")
      throw new ConnectionError(
        403,
        "verification_required",
        "Verify your admin email before connecting an AI assistant.",
      );
    return {
      id: String(row.id),
      name: String(row.name || "Aim4price Admin"),
      email: String(row.email),
    };
  }
  if (
    (config.accessMode !== "owners" &&
      !config.allowedUserIds.includes(userId)) ||
    userId.startsWith("aim4price-assistance-")
  )
    throw new ConnectionError(
      403,
      "access_denied",
      "This account is not enabled for AI connections.",
    );
  const row = (
    await db.query(
      `SELECT u.id,u.name,u.email,p.account_type,p.account_status,
    p.business_name,coalesce(s.plan,'desktop') AS plan
    FROM public."user" u JOIN public.account_profiles p ON p.user_id=u.id
    LEFT JOIN public.sharing_account_access s ON s.user_id=u.id WHERE u.id=$1`,
      [userId],
    )
  ).rows[0];
  // Pilot is intentionally limited to direct owner accounts, not delegated/app/admin identities.
  if (
    !row ||
    isAim4priceAdminEmail(row.email) ||
    row.account_type !== "owner" ||
    row.account_status !== "active" ||
    row.plan !== "desktop"
  )
    throw new ConnectionError(
      403,
      "access_denied",
      "An active Owner desktop account is required.",
    );
  return {
    id: String(row.id),
    name: String(row.business_name || row.name || "Owner account"),
    email: String(row.email),
  };
}
export async function issueCode(
  pool: ConnectionDb,
  userId: string,
  auth: Authorization,
  proof: string,
  config: ConnectionConfig,
) {
  const code = opaqueToken();
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await eligibleAccount(db, userId, config);
    // A consent form can only be submitted once, including concurrent submissions.
    await db.query(
      `INSERT INTO public.ai_connection_codes(code_hash,user_id,client_id,redirect_uri,challenge,resource,scope,expires_at,consent_hash)
      VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '5 minutes',$8)`,
      [
        digest(code),
        userId,
        auth.clientId,
        auth.redirectUri,
        auth.challenge,
        auth.resource,
        auth.scope,
        digest(proof),
      ],
    );
    await db.query("COMMIT");
    return code;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
export function authenticateClient(
  form: URLSearchParams,
  authorization: string | null,
  config: ConnectionConfig,
) {
  let id = form.get("client_id") || "";
  let secret = form.get("client_secret") || "";
  if (authorization) {
    if (id || secret || !authorization.startsWith("Basic "))
      throw new ConnectionError(
        401,
        "invalid_client",
        "Invalid client authentication.",
      );
    const decoded = Buffer.from(authorization.slice(6), "base64").toString();
    const colon = decoded.indexOf(":");
    if (colon < 0)
      throw new ConnectionError(
        401,
        "invalid_client",
        "Invalid client authentication.",
      );
    id = decodeURIComponent(decoded.slice(0, colon));
    secret = decodeURIComponent(decoded.slice(colon + 1));
  }
  config = selectClient(config, id);
  if (!secureEqual(secret, config.clientSecret))
    throw new ConnectionError(
      401,
      "invalid_client",
      "Invalid client authentication.",
    );
  return config;
}
export async function exchangeToken(
  pool: ConnectionDb,
  form: URLSearchParams,
  config: ConnectionConfig,
) {
  if (form.get("resource") !== config.resource)
    throw new ConnectionError(400, "invalid_target", "Incorrect API resource.");
  if (form.has("scope") && form.get("scope") !== connectionScope(config))
    throw new ConnectionError(
      400,
      "invalid_scope",
      "Only read-only access is supported.",
    );
  const grantType = form.get("grant_type");
  if (!["authorization_code", "refresh_token"].includes(grantType || ""))
    throw new ConnectionError(
      400,
      "unsupported_grant_type",
      "Unsupported grant.",
    );
  const access = opaqueToken(),
    refresh = opaqueToken();
  const db = await pool.connect();
  let committed = false;
  let expiresIn = 3600;
  try {
    await db.query("BEGIN");
    if (grantType === "authorization_code") {
      const verifier = form.get("code_verifier") || "";
      if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier))
        throw new ConnectionError(
          400,
          "invalid_grant",
          "Invalid sign-in challenge.",
        );
      const code = (
        await db.query(
          `UPDATE public.ai_connection_codes SET used_at=now() WHERE code_hash=$1 AND client_id=$2 AND resource=$3 AND scope=$4 AND expires_at>now() AND used_at IS NULL RETURNING *`,
          [
            digest(form.get("code") || ""),
            config.clientId,
            config.resource,
            connectionScope(config),
          ],
        )
      ).rows[0];
      if (
        !code ||
        code.redirect_uri !== form.get("redirect_uri") ||
        !secureEqual(code.challenge, pkce(verifier))
      )
        throw new ConnectionError(
          400,
          "invalid_grant",
          "The sign-in code is invalid or expired.",
        );
      await eligibleAccount(db, code.user_id, config);
      const connectionId = randomUUID();
      await db.query(
        `INSERT INTO public.ai_connections(id,user_id,client_id,resource,scope,access_hash,refresh_hash,access_expires_at,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '1 hour',now()+($8::integer * interval '1 day'))`,
        [
          connectionId,
          code.user_id,
          config.clientId,
          config.resource,
          connectionScope(config),
          digest(access),
          digest(refresh),
          config.audience === "admin" ? 1 : 30,
        ],
      );
      await db.query(
        "INSERT INTO public.ai_connection_refresh_tokens(token_hash,connection_id) VALUES($1,$2)",
        [digest(refresh), connectionId],
      );
    } else {
      const grant = (
        await db.query(
          `SELECT g.*,h.used_at FROM public.ai_connection_refresh_tokens h JOIN public.ai_connections g ON g.id=h.connection_id WHERE h.token_hash=$1 AND g.client_id=$2 AND g.resource=$3 AND g.scope=$4 AND g.revoked_at IS NULL AND g.expires_at>now() FOR UPDATE OF g,h`,
          [
            digest(form.get("refresh_token") || ""),
            config.clientId,
            config.resource,
            connectionScope(config),
          ],
        )
      ).rows[0];
      if (!grant)
        throw new ConnectionError(
          400,
          "invalid_grant",
          "The connection expired or was disconnected.",
        );
      if (
        grant.used_at ||
        grant.refresh_hash !== digest(form.get("refresh_token") || "")
      ) {
        await db.query(
          "UPDATE public.ai_connections SET revoked_at=now() WHERE id=$1",
          [grant.id],
        );
        await db.query("COMMIT");
        committed = true;
        throw new ConnectionError(
          400,
          "invalid_grant",
          "This connection was disconnected after a reused refresh token. Reconnect your account.",
        );
      }
      await eligibleAccount(db, grant.user_id, config);
      expiresIn = Math.max(
        0,
        Math.min(
          3600,
          Math.floor(
            (new Date(grant.expires_at).getTime() - Date.now()) / 1000,
          ),
        ),
      );
      await db.query(
        "UPDATE public.ai_connection_refresh_tokens SET used_at=now() WHERE token_hash=$1",
        [grant.refresh_hash],
      );
      await db.query(
        "INSERT INTO public.ai_connection_refresh_tokens(token_hash,connection_id) VALUES($1,$2)",
        [digest(refresh), grant.id],
      );
      await db.query(
        `UPDATE public.ai_connections SET access_hash=$2,refresh_hash=$3,access_expires_at=least(now()+interval '1 hour',expires_at) WHERE id=$1`,
        [grant.id, digest(access), digest(refresh)],
      );
    }
    await db.query("COMMIT");
    committed = true;
    return {
      access_token: access,
      token_type: "Bearer",
      expires_in: expiresIn,
      refresh_token: refresh,
      scope: connectionScope(config),
    };
  } catch (error) {
    if (!committed) await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
export async function authenticateToken(
  db: Reader,
  bearer: string | null,
  config: ConnectionConfig,
) {
  if (!bearer || !/^Bearer [A-Za-z0-9_-]{43}$/.test(bearer))
    throw new ConnectionError(
      401,
      "invalid_token",
      "Connect your Aim4price account to continue.",
    );
  const grant = (
    await db.query(
      `SELECT id,user_id,client_id FROM public.ai_connections WHERE access_hash=$1 AND resource=$2 AND scope=$3 AND revoked_at IS NULL AND access_expires_at>now() AND expires_at>now()`,
      [digest(bearer.slice(7)), config.resource, connectionScope(config)],
    )
  ).rows[0];
  if (!grant)
    throw new ConnectionError(
      401,
      "invalid_token",
      "Reconnect your Aim4price account.",
    );
  let selected: ConnectionConfig;
  try {
    selected = selectClient(config, grant.client_id);
  } catch {
    throw new ConnectionError(
      401,
      "invalid_token",
      "This provider is no longer enabled.",
    );
  }
  const account = await eligibleAccount(db, grant.user_id, selected);
  return { connectionId: String(grant.id), account, config: selected };
}
