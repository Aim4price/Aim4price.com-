import { isMiddlemanAccountSubtype } from "../middleman-account";
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
      accountType: "admin" as const,
      id: String(row.id),
      name: String(row.name || "Aim4price Admin"),
      email: String(row.email),
    };
  }
  if (userId.startsWith("aim4price-assistance-"))
    throw new ConnectionError(403, "direct_account_required", "Sign in with your own Aim4price account to connect an assistant.");
  const row = (
    await db.query(
      `SELECT u.id,u.name,u.email,p.account_type,p.account_status,
    p.business_name,to_jsonb(u)->>'emailVerified' AS verified,
    to_jsonb(p)->>'account_subtype' AS account_subtype,coalesce(s.plan,'desktop') AS plan
    FROM public."user" u JOIN public.account_profiles p ON p.user_id=u.id
    LEFT JOIN public.sharing_account_access s ON s.user_id=u.id WHERE u.id=$1`,
      [userId],
    )
  ).rows[0];
  // Direct website account principals only; never promote a staff session.
  if (!row)
    throw new ConnectionError(403, "account_required", "Complete your Aim4price account setup before connecting.");
  if (isAim4priceAdminEmail(row.email))
    throw new ConnectionError(403, "admin_connection_required", "Use the Admin AI connections page for this administrator account.");
  if (!["owner", "dealer", "business"].includes(row.account_type) || isMiddlemanAccountSubtype(row.account_subtype))
    throw new ConnectionError(403, "unsupported_account_type", "AI connections are available for Owner, Dealer and Business accounts. This account type is not supported yet.");
  if (row.account_status !== "active")
    throw new ConnectionError(403, "inactive_account", "Your Aim4price account is not active. Contact Aim4price Admin to review your account status.");
  if (row.account_type !== "business" && row.plan !== "desktop")
    throw new ConnectionError(403, "desktop_required", "Your Owner or Dealer account needs desktop access to connect an AI assistant.");
  if (row.account_type !== "owner" && row.verified !== "true")
    throw new ConnectionError(403, "verification_required", "Verify your account email before connecting.");
  if (row.account_type === "business") {
    // Mirror canBusinessRead without schema writes inside an AI read transaction.
    const membership = (await db.query(`SELECT m.business_id FROM public.business_workspace_members m
      JOIN public.business_workspaces w ON w.id=m.business_id
      WHERE m.user_id=$1 AND m.status='active' AND m.role='owner' AND w.owner_user_id=$1
      AND NOT EXISTS (SELECT 1 FROM public.business_verified_identities i
        JOIN public.guest_businesses g ON g.email=i.email WHERE i.business_id=m.business_id AND g.suspended)
      AND NOT EXISTS (SELECT 1 FROM public.business_verified_identities i WHERE i.email=lower($2) AND i.business_id<>m.business_id)`, [userId, row.email])).rows[0];
    if (!membership) throw new ConnectionError(403, "access_denied", "An active business workspace owner is required.");
  }
  return {
    accountType: row.account_type as "owner" | "dealer" | "business",
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
  expectedAccountType?: string,
) {
  const code = opaqueToken();
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const account = await eligibleAccount(db, userId, config);
    if (expectedAccountType !== undefined) requireGrantAccountType(expectedAccountType, account.accountType);
    // A consent form can only be submitted once, including concurrent submissions.
    await db.query(
      `INSERT INTO public.ai_connection_codes(code_hash,user_id,client_id,redirect_uri,challenge,resource,scope,expires_at,consent_hash,account_type)
      VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '5 minutes',$8,$9)`,
      [
        digest(code),
        userId,
        auth.clientId,
        auth.redirectUri,
        auth.challenge,
        auth.resource,
        auth.scope,
        digest(proof),
        account.accountType,
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
      const account = await eligibleAccount(db, code.user_id, config);
      requireGrantAccountType(code.account_type, account.accountType);
      const connectionId = randomUUID();
      await db.query(
        `INSERT INTO public.ai_connections(id,user_id,client_id,resource,scope,access_hash,refresh_hash,access_expires_at,expires_at,account_type)
        VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '1 hour',now()+($8::integer * interval '1 day'),$9)`,
        [
          connectionId,
          code.user_id,
          config.clientId,
          config.resource,
          connectionScope(config),
          digest(access),
          digest(refresh),
          config.audience === "admin" ? 1 : null,
          account.accountType,
        ],
      );
      await db.query(
        "INSERT INTO public.ai_connection_refresh_tokens(token_hash,connection_id) VALUES($1,$2)",
        [digest(refresh), connectionId],
      );
    } else {
      const grant = (
        await db.query(
          `SELECT g.*,h.used_at FROM public.ai_connection_refresh_tokens h JOIN public.ai_connections g ON g.id=h.connection_id WHERE h.token_hash=$1 AND g.client_id=$2 AND g.resource=$3 AND g.scope=$4 AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>now()) FOR UPDATE OF g,h`,
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
      const account = await eligibleAccount(db, grant.user_id, config);
      requireGrantAccountType(grant.account_type, account.accountType);
      expiresIn = grant.expires_at === null ? 3600 : Math.max(
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
      `SELECT id,user_id,client_id,account_type FROM public.ai_connections WHERE access_hash=$1 AND resource=$2 AND scope=$3 AND revoked_at IS NULL AND access_expires_at>now() AND (expires_at IS NULL OR expires_at>now())`,
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
  requireGrantAccountType(grant.account_type, account.accountType);
  return { connectionId: String(grant.id), account, config: selected };
}

function requireGrantAccountType(granted: string, current: string) {
  if (granted !== current) throw new ConnectionError(401, "invalid_token", "Your account access changed. Reconnect to review its permissions.");
}
