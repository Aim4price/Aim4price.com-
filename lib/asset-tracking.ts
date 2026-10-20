import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getDb } from "./db";
import type { TrackingPoint } from "./asset-tracking-math";
let schema: Promise<unknown> | undefined;
export function ensureTrackingTables() {
  if (!schema)
    schema = getDb()
      .query(
        `
 CREATE TABLE IF NOT EXISTS public.asset_tracking_devices(
 id uuid PRIMARY KEY, asset_id uuid NOT NULL REFERENCES public.asset_register_items(id) ON DELETE CASCADE,
 owner_id text NOT NULL, token_hash text UNIQUE, pair_hash text UNIQUE, pair_expires_at timestamptz,
 name text NOT NULL DEFAULT 'Equipment phone', revoked_at timestamptz, paired_at timestamptz,
 upload_window timestamptz, upload_count integer NOT NULL DEFAULT 0,
 last_seen_at timestamptz, active boolean NOT NULL DEFAULT false, state_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now());
 ALTER TABLE public.asset_tracking_devices ADD COLUMN IF NOT EXISTS diagnostics jsonb;
 CREATE INDEX IF NOT EXISTS tracking_device_asset ON public.asset_tracking_devices(asset_id);
 CREATE TABLE IF NOT EXISTS public.asset_tracking_points(
 device_id uuid NOT NULL REFERENCES public.asset_tracking_devices(id) ON DELETE CASCADE,
 sample_id uuid NOT NULL, session_id uuid NOT NULL, captured_at timestamptz NOT NULL,
 latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 accuracy real NOT NULL CHECK(accuracy BETWEEN 0 AND 5000),
 motion text NOT NULL CHECK(motion IN ('moving','stationary')),
 received_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(device_id,sample_id));
 ALTER TABLE public.asset_tracking_points ADD COLUMN IF NOT EXISTS history_deleted_at timestamptz;
 ALTER TABLE public.asset_tracking_points ADD COLUMN IF NOT EXISTS recovered_by_device_id uuid;
 CREATE UNIQUE INDEX IF NOT EXISTS tracking_points_ten_seconds ON public.asset_tracking_points(device_id,(floor(extract(epoch FROM captured_at AT TIME ZONE 'UTC') / 10)));
 DROP INDEX IF EXISTS public.tracking_points_minute;
 CREATE INDEX IF NOT EXISTS tracking_points_time ON public.asset_tracking_points(device_id,captured_at DESC);
 `,
      )
      .catch((e) => {
        schema = undefined;
        throw e;
      });
  return schema;
}
export const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function createPairing(ownerId: string, assetId: string) {
  await ensureTrackingTables();
  const code = randomBytes(8).toString("hex").toUpperCase();
  const db = getDb(),
    client = await db.connect();
  try {
    await client.query("BEGIN");
    const owned = await client.query(
      "SELECT id FROM public.asset_register_items WHERE id=$1 AND user_id=$2 FOR UPDATE",
      [assetId, ownerId],
    );
    if (!owned.rowCount) throw Error("ASSET_UNAVAILABLE");
    await client.query(
      "DELETE FROM public.asset_tracking_devices WHERE asset_id=$1 AND paired_at IS NULL",
      [assetId],
    );
    await client.query(
      `INSERT INTO public.asset_tracking_devices(id,asset_id,owner_id,pair_hash,pair_expires_at) VALUES($1,$2,$3,$4,now()+interval '15 minutes')`,
      [randomUUID(), assetId, ownerId, hashToken(code)],
    );
    await client.query("COMMIT");
    return code.match(/.{4}/g)!.join("-");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function pairDevice(code: string, name: string) {
  await ensureTrackingTables();
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const lookup = await client.query(
      `SELECT d.asset_id FROM public.asset_tracking_devices d WHERE pair_hash=$1 AND pair_expires_at>now() AND revoked_at IS NULL`,
      [hashToken(code)],
    );
    if (!lookup.rowCount) throw Error("INVALID_PAIRING");
    // Same lock order as re-pair/revoke: asset then device.
    await client.query(
      "SELECT id FROM public.asset_register_items WHERE id=$1 FOR UPDATE",
      [lookup.rows[0].asset_id],
    );
    const found = await client.query(
      `SELECT d.*,a.title FROM public.asset_tracking_devices d JOIN public.asset_register_items a ON a.id=d.asset_id AND a.user_id=d.owner_id WHERE pair_hash=$1 AND pair_expires_at>now() AND revoked_at IS NULL FOR UPDATE OF d`,
      [hashToken(code)],
    );
    if (!found.rowCount) throw Error("INVALID_PAIRING");
    const d = found.rows[0],
      token = randomBytes(32).toString("hex");
    await client.query(
      "UPDATE public.asset_tracking_devices SET revoked_at=now(),active=false,pair_hash=NULL WHERE asset_id=$1 AND id<>$2 AND revoked_at IS NULL",
      [d.asset_id, d.id],
    );
    await client.query(
      "UPDATE public.asset_tracking_devices SET token_hash=$2,pair_hash=NULL,pair_expires_at=NULL,paired_at=now(),name=$3 WHERE id=$1",
      [d.id, hashToken(token), name],
    );
    await client.query("COMMIT");
    return { token, assetTitle: d.title, assetId: d.asset_id, deviceId: d.id };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export type UploadPoint = TrackingPoint & {
  id: string;
  motion: "moving" | "stationary";
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateUpload(
  body: any,
  now = Date.now(),
): { points: UploadPoint[]; active: boolean; stateAt: string; diagnostics:Record<string,number|string>|null; rejected:{id:string;reason:string}[]; recoveryToken?:string } {
  if (
    !body ||
    !Array.isArray(body.points) ||
    body.points.length > 120 ||
    typeof body.active !== "boolean" ||
    typeof body.stateAt !== "string"
  )
    throw Error("INVALID_UPLOAD");
  const state = Date.parse(body.stateAt);
  if (!Number.isFinite(state) || Math.abs(now - state) > 300000)
    throw Error("INVALID_UPLOAD");
  if(body.recoveryToken!==undefined && (typeof body.recoveryToken!=='string'||!/^[a-f0-9]{64}$/.test(body.recoveryToken)))throw Error("INVALID_UPLOAD");
  const rejected:{id:string;reason:string}[]=[];
  const points = body.points.flatMap((p: any) => {
    if (
      !p ||
      !uuid.test(p.id) ||
      !uuid.test(p.sessionId) ||
      typeof p.capturedAt !== "string" ||
      !Number.isFinite(Date.parse(p.capturedAt)) ||
      Date.parse(p.capturedAt) > now + 120000 ||
      Date.parse(p.capturedAt) < now - 30 * 86400000 ||
      !["moving", "stationary"].includes(p.motion) ||
      !["latitude", "longitude", "accuracy"].every(
        (k) => typeof p[k] === "number" && Number.isFinite(p[k]),
      ) ||
      Math.abs(p.latitude) > 90 ||
      Math.abs(p.longitude) > 180 ||
      p.accuracy < 0 ||
      p.accuracy > 5000
    ) {
      if(body.partial!==true || !p || typeof p.id!=='string' || !uuid.test(p.id))throw Error("INVALID_UPLOAD");
      rejected.push({id:p.id,reason:Date.parse(p.capturedAt)<now-30*86400000?'Reading is older than 30 days':Date.parse(p.capturedAt)>now+120000?'Capture time is in the future':'Invalid GPS reading'});
      return [];
    }
    return [{
      id: p.id,
      sessionId: p.sessionId,
      capturedAt: p.capturedAt,
      latitude: p.latitude,
      longitude: p.longitude,
      accuracy: p.accuracy,
      motion: p.motion,
    } as UploadPoint];
  });
  const diagnostics:Record<string,number|string>={};
  if(body.diagnostics&&typeof body.diagnostics==='object'){
    for(const key of ['pending','retained','rejectedFixes','accuracy','batteryPercent','backgroundLocation','recording']){
      const value=body.diagnostics[key];
      const maximum=key==='batteryPercent'?100:['backgroundLocation','recording'].includes(key)?1:1e9;
      if(typeof value==='number'&&Number.isFinite(value)&&value>=(key==='accuracy'?-1:0)&&value<=maximum&&(key==='accuracy'||Number.isInteger(value)))diagnostics[key]=value;
    }
    for(const key of ['lastCallbackAt','lastGpsAt','lastSavedAt']){
      const value=body.diagnostics[key];
      if(typeof value==='string'&&value.length<=30&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=now+120000)diagnostics[key]=new Date(value).toISOString();
    }
    if(typeof body.diagnostics.version==='string'&&/^\d+\.\d+(?:\.\d+)?$/.test(body.diagnostics.version))diagnostics.version=body.diagnostics.version;
    if(['gps','fused','unknown'].includes(body.diagnostics.provider))diagnostics.provider=body.diagnostics.provider;
  }
  return { points, rejected, recoveryToken:body.recoveryToken, active: body.active, stateAt: body.stateAt, diagnostics:Object.keys(diagnostics).length?diagnostics:null };
}
export async function ingestTracking(
  token: string,
  body: ReturnType<typeof validateUpload>,
) {
  await ensureTrackingTables();
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT d.* FROM public.asset_tracking_devices d JOIN public.asset_register_items a ON a.id=d.asset_id AND a.user_id=d.owner_id WHERE token_hash=$1 AND revoked_at IS NULL FOR UPDATE OF d`,
      [hashToken(token)],
    );
    if (!result.rowCount) throw Error("DEVICE_REVOKED");
    const device = result.rows[0];
    let sourceDevice=device;
    if(body.recoveryToken){
      const old=await client.query("SELECT * FROM public.asset_tracking_devices WHERE token_hash=$1 AND owner_id=$2 AND asset_id=$3 AND revoked_at IS NOT NULL",[hashToken(body.recoveryToken),device.owner_id,device.asset_id]);
      if(!old.rowCount)throw Error("RECOVERY_UNAVAILABLE");
      sourceDevice=old.rows[0];
    }
    const rejected=[...(body.rejected||[])];
    const points=body.points.filter(p=>{
      if(body.recoveryToken && Date.parse(p.capturedAt)>new Date(sourceDevice.revoked_at).getTime()){
        rejected.push({id:p.id,reason:'Captured after the original phone was disconnected'});return false;
      }
      return true;
    });
    const windowFresh =
      device.upload_window &&
      Date.now() - new Date(device.upload_window).getTime() < 60000;
    if (windowFresh && device.upload_count >= 40) throw Error("RATE_LIMIT");
    await client.query(
      "UPDATE public.asset_tracking_devices SET upload_window=$2,upload_count=$3 WHERE id=$1",
      [
        device.id,
        windowFresh ? device.upload_window : new Date(),
        windowFresh ? device.upload_count + 1 : 1,
      ],
    );
    // Row locking above serializes retries and revocation for this credential.
    for (const p of points)
      await client.query(
        `INSERT INTO public.asset_tracking_points(device_id,sample_id,session_id,captured_at,latitude,longitude,accuracy,motion,recovered_by_device_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
        [
          sourceDevice.id,
          p.id,
          p.sessionId,
          p.capturedAt,
          p.latitude,
          p.longitude,
          p.accuracy,
          p.motion,
          body.recoveryToken ? device.id : null,
        ],
      );
    await client.query(
      `UPDATE public.asset_tracking_devices SET last_seen_at=now(),active=CASE WHEN state_at IS NULL OR state_at <= $3::timestamptz THEN $2 ELSE active END,diagnostics=CASE WHEN state_at IS NULL OR state_at <= $3::timestamptz THEN COALESCE($4::jsonb,diagnostics) ELSE diagnostics END,state_at=GREATEST(state_at,$3::timestamptz) WHERE id=$1`,
      [device.id, body.active, body.stateAt,body.diagnostics?JSON.stringify(body.diagnostics):null],
    );
    await client.query("COMMIT");
    return { accepted: points.map((p) => p.id), rejected };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function trackingStatus(ownerId: string, assetId: string) {
  await ensureTrackingTables();
  const r = await getDb().query(
    `SELECT d.id,d.name,d.paired_at,d.last_seen_at,d.active,d.diagnostics,p.accuracy,p.captured_at,p.latitude,p.longitude,p.motion FROM public.asset_tracking_devices d JOIN public.asset_register_items a ON a.id=d.asset_id AND a.user_id=d.owner_id LEFT JOIN LATERAL(SELECT * FROM public.asset_tracking_points WHERE device_id=d.id AND accuracy<=50 ORDER BY captured_at DESC LIMIT 1)p ON true WHERE d.owner_id=$1 AND d.asset_id=$2 AND d.revoked_at IS NULL AND d.paired_at IS NOT NULL ORDER BY d.created_at DESC LIMIT 1`,
    [ownerId, assetId],
  );
  if (!r.rowCount) return null;
  const d = r.rows[0];
  return {
    id: d.id,
    name: d.name,
    diagnostics:d.diagnostics,
    accuracy:d.accuracy,
    lastSeenAt: d.last_seen_at,
    lastCapturedAt: d.captured_at,
    latitude: d.latitude,
    longitude: d.longitude,
    status: !d.last_seen_at
      ? "Waiting"
      : Date.now() - new Date(d.last_seen_at).getTime() > 12 * 60000
        ? "Offline"
        : !d.active
          ? "Deactivated"
          : d.diagnostics?.recording===0
            ? "Open phone to resume"
          : !d.captured_at ||
              Date.now() - new Date(d.captured_at).getTime() > 12 * 60000
            ? "No recent GPS"
            : d.motion === "stationary"
              ? "Stopped"
              : "Moving",
  };
}

export async function latestTrackingPositions(ownerId: string) {
  await ensureTrackingTables();
  const result = await getDb().query(
    `SELECT assets.asset_id,current_phone.id AS connected_device_id,current_phone.active,current_phone.last_seen_at,current_phone.diagnostics,p.*
     FROM (SELECT DISTINCT d.asset_id FROM public.asset_tracking_devices d
       JOIN public.asset_register_items a ON a.id=d.asset_id AND a.user_id=d.owner_id
       WHERE d.owner_id=$1 AND d.paired_at IS NOT NULL) assets
     LEFT JOIN LATERAL (
       SELECT d.id,d.active,d.last_seen_at,d.diagnostics FROM public.asset_tracking_devices d
       WHERE d.asset_id=assets.asset_id AND d.owner_id=$1 AND d.revoked_at IS NULL AND d.paired_at IS NOT NULL
       ORDER BY d.paired_at DESC,d.id DESC LIMIT 1
     ) current_phone ON true
     LEFT JOIN LATERAL (
       SELECT p.latitude,p.longitude,p.captured_at,p.motion,p.device_id
       FROM public.asset_tracking_points p JOIN public.asset_tracking_devices d ON d.id=p.device_id
       WHERE d.asset_id=assets.asset_id AND d.owner_id=$1 AND d.paired_at IS NOT NULL AND p.accuracy<=50
       ORDER BY p.captured_at DESC,p.received_at DESC,p.sample_id DESC LIMIT 1
     ) p ON true`,
    [ownerId],
  );
  return new Map(result.rows.map((row) => [row.asset_id, row]));
}

/** Disconnect credentials only: locations and history belong to the asset. */
export async function disconnectTrackingDevice(ownerId: string, assetId: string) {
  await ensureTrackingTables();
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const owned = await client.query("SELECT id FROM public.asset_register_items WHERE id=$1 AND user_id=$2 FOR UPDATE", [assetId, ownerId]);
    if (!owned.rowCount) throw Error("ASSET_UNAVAILABLE");
    await client.query("UPDATE public.asset_tracking_devices SET revoked_at=now(),active=false,pair_hash=NULL,pair_expires_at=NULL WHERE asset_id=$1 AND owner_id=$2 AND revoked_at IS NULL", [assetId, ownerId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
