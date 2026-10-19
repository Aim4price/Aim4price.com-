import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
const source = readFileSync(
  new URL("../lib/asset-tracking-math.ts", import.meta.url),
  "utf8",
);
const compile = (s) =>
  "data:text/javascript;base64," +
  Buffer.from(
    ts.transpileModule(s, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  ).toString("base64");
const {trackerPairingUrl}=await import(compile(readFileSync(new URL("../lib/asset-tracking-links.ts",import.meta.url),"utf8")));
const { summarizeTracking } = await import(compile(source));
const sessionId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const base = Date.parse("2026-10-18T08:00:00Z");
const point = (minute, longitude, extra = {}) => ({
  capturedAt: new Date(base + minute * 60000).toISOString(),
  latitude: 0,
  longitude,
  accuracy: 5,
  sessionId,
  ...extra,
});
test("one-minute route produces distance and time-based speed", () => {
  const r = summarizeTracking([point(2, 0.002), point(0, 0), point(1, 0.001)]);
  assert.ok(Math.abs(r.distanceKm - 0.22239) < 0.001);
  assert.equal(r.movingSeconds, 120);
  assert.ok(Math.abs(r.averageMovingKmh - 6.6717) < 0.01);
  assert.equal(r.segments.length, 1);
});
test("stationary GPS jitter does not accumulate distance, including ten-minute heartbeats", () => {
  const r = summarizeTracking([
    point(0, 0),
    point(1, 0.00001),
    point(11, -0.00001),
    point(21, 0),
  ]);
  assert.equal(r.distanceKm, 0);
  assert.equal(r.stationarySeconds, 1260);
});
test("missing readings and separate sessions never become invented routes", () => {
  const r = summarizeTracking([
    point(0, 0),
    point(10, 0.1),
    point(11, 0.101, { sessionId: "other" }),
  ]);
  assert.equal(r.distanceKm, 0);
  assert.equal(r.gapSeconds, 660);
  assert.equal(r.segments.length, 3);
});
test("bad fixes and implausible jumps do not inflate distance", () => {
  const r = summarizeTracking([
    point(0, 0),
    point(1, 10),
    point(2, 10.01, { accuracy: 200 }),
    point(3, 11),
  ]);
  assert.equal(r.distanceKm, 0);
});
test("time calculation uses timestamps, never assumed point count", () => {
  const r = summarizeTracking([point(0, 0), point(1.5, 0.001)]);
  assert.equal(r.movingSeconds, 90);
});
const db = new PGlite();
await db.exec(
  "CREATE TABLE asset_register_items(id uuid PRIMARY KEY,user_id text,title text)",
);
const asset = "11111111-1111-4111-8111-111111111111";
await db.query("INSERT INTO asset_register_items VALUES($1,$2,$3)", [
  asset,
  "owner",
  "Tractor",
]);
const adapter = {
  query: async (q, args) => {
    if (!args && q.includes("CREATE TABLE")) {
      await db.exec(q);
      return { rows: [], rowCount: 0 };
    }
    const r = await db.query(q, args);
    return { ...r, rowCount: r.rows.length || r.affectedRows || 0 };
  },
  connect: async () => ({ ...adapter, release() {} }),
};
globalThis.__trackingTestDb = adapter;
const tracking = readFileSync(
  new URL("../lib/asset-tracking.ts", import.meta.url),
  "utf8",
).replace(
  /import\s*\{\s*getDb\s*\}\s*from\s*['"]\.\/db['"];?/,
  "const getDb=()=>globalThis.__trackingTestDb;",
);
const api = await import(compile(tracking));
let token;
test("pairing checks ownership, expires, is one-time and stores only credential hashes", async () => {
  await assert.rejects(api.createPairing("intruder", asset));
  const code = await api.createPairing("owner", asset);
  assert.ok(trackerPairingUrl(code),"real database pairing code must produce a QR URL");
  const paired = await api.pairDevice(code.replaceAll("-", ""), "Pilot");
  token = paired.token;
  await assert.rejects(api.pairDevice(code.replaceAll("-", ""), "Other"));
  const rows = await db.query(
    "SELECT * FROM asset_tracking_devices WHERE paired_at IS NOT NULL",
  );
  assert.equal(rows.rows[0].token_hash, api.hashToken(token));
  assert.equal(rows.rows[0].pair_hash, null);
});
test("batch retries are idempotent and late arrivals cannot replace latest position", async () => {
  const now = Date.now();
  const sample = (mins, lon) => ({
    id: crypto.randomUUID(),
    sessionId,
    capturedAt: new Date(now - mins * 60000).toISOString(),
    latitude: 0,
    longitude: lon,
    accuracy: 5,
    motion: "moving",
  });
  const newer = sample(0, 0.01),
    older = sample(5, 0);
  const body = (points) =>
    api.validateUpload({
      points,
      active: true,
      stateAt: new Date().toISOString(),
    });
  await api.ingestTracking(token, body([newer]));
  await api.ingestTracking(token, body([older, newer]));
  const count = await db.query(
    "SELECT count(*)::int AS n FROM asset_tracking_points",
  );
  assert.equal(count.rows[0].n, 2);
  const status = await api.trackingStatus("owner", asset);
  assert.equal(status.longitude, 0.01);
  assert.equal(await api.trackingStatus("intruder", asset), null);
});
test("a second UUID in the same ten-second bucket cannot multiply stored points", async () => {
  const p = {
    id: crypto.randomUUID(),
    sessionId,
    capturedAt: (await db.query('SELECT captured_at FROM asset_tracking_points ORDER BY captured_at DESC LIMIT 1')).rows[0].captured_at.toISOString(),
    latitude: 0,
    longitude: 2,
    accuracy: 5,
    motion: "moving",
  };
  await api.ingestTracking(
    token,
    api.validateUpload({
      points: [p],
      active: true,
      stateAt: new Date().toISOString(),
    }),
  );
  const n = await db.query(
    "SELECT count(*)::int AS n FROM asset_tracking_points",
  );
  assert.equal(n.rows[0].n, 2);
});
test("invalid coordinates, oversized batches and future dates are rejected", () => {
  const p = {
    id: crypto.randomUUID(),
    sessionId,
    capturedAt: new Date().toISOString(),
    latitude: 91,
    longitude: 0,
    accuracy: 5,
    motion: "moving",
  };
  const b = { points: [p], active: true, stateAt: new Date().toISOString() };
  assert.throws(() => api.validateUpload(b));
  assert.throws(() => api.validateUpload({ ...b, points: Array(121).fill(p) }));
  assert.throws(() =>
    api.validateUpload({
      ...b,
      points: [
        {
          ...p,
          latitude: 0,
          capturedAt: new Date(Date.now() + 600000).toISOString(),
        },
      ],
    }),
  );
});
test("expired pairing codes are rejected", async () => {
  const c = await api.createPairing("owner", asset);
  await db.query(
    "UPDATE asset_tracking_devices SET pair_expires_at=now()-interval '1 minute' WHERE pair_hash=$1",
    [api.hashToken(c.replaceAll("-", ""))],
  );
  await assert.rejects(
    api.pairDevice(c.replaceAll("-", ""), "Expired"),
    /INVALID_PAIRING/,
  );
});
test("upload throttle bounds authenticated traffic", async () => {
  await db.query(
    "UPDATE asset_tracking_devices SET upload_window=now(),upload_count=40 WHERE token_hash=$1",
    [api.hashToken(token)],
  );
  await assert.rejects(
    api.ingestTracking(token, {
      points: [],
      active: true,
      stateAt: new Date().toISOString(),
    }),
    /RATE_LIMIT/,
  );
  await db.query(
    "UPDATE asset_tracking_devices SET upload_window=now()-interval '2 minutes' WHERE token_hash=$1",
    [api.hashToken(token)],
  );
});
test("re-pairing revokes old credentials and ownership transfer invalidates new credentials", async () => {
  const code = await api.createPairing("owner", asset);
  const replacement = await api.pairDevice(
    code.replaceAll("-", ""),
    "Replacement",
  );
  const b = { points: [], active: true, stateAt: new Date().toISOString() };
  await assert.rejects(api.ingestTracking(token, b), /DEVICE_REVOKED/);
  await db.query("UPDATE asset_register_items SET user_id=$1 WHERE id=$2", [
    "new-owner",
    asset,
  ]);
  await assert.rejects(
    api.ingestTracking(replacement.token, b),
    /DEVICE_REVOKED/,
  );
});
test.after(() => db.close());

test("six ten-second readings survive ingestion and retries",async()=>{
 const code=await api.createPairing('new-owner',asset);const paired=await api.pairDevice(code.replaceAll('-',''),'Ten second test');
 const start=Math.floor((Date.now()-120000)/60000)*60000;
 const points=Array.from({length:6},(_,i)=>({id:crypto.randomUUID(),sessionId,capturedAt:new Date(start+i*10000).toISOString(),latitude:0,longitude:i*.001,accuracy:5,motion:'moving'}));
 const body=api.validateUpload({points,active:true,stateAt:new Date().toISOString()});await api.ingestTracking(paired.token,body);await api.ingestTracking(paired.token,body);
 const result=await db.query('SELECT count(*)::int AS n FROM asset_tracking_points WHERE device_id=$1',[paired.deviceId]);assert.equal(result.rows[0].n,6);
 const report=summarizeTracking(points);assert.equal(report.readings.length,6);assert.equal(report.movingSeconds,50);assert.ok(report.distanceKm>.55);
});

test("slow ten-second movement is accumulated beyond the drift threshold",()=>{
 const points=Array.from({length:7},(_,i)=>point(i/6,i*.00005));
 const report=summarizeTracking(points);assert.ok(report.distanceKm>.032);assert.equal(report.movingSeconds,60);assert.equal(report.stationarySeconds,0);
});
test("rejected fixes remain visible as missing coverage rather than disappearing from time totals",()=>{
 const r=summarizeTracking([point(0,0),point(1,.001,{accuracy:200}),point(2,.002)]);
 assert.equal(r.gapSeconds,120);
 assert.equal(r.movingSeconds+r.stationarySeconds+r.gapSeconds,120);
 assert.equal(r.segments.length,2);
});
test("two devices using the same session identifier never form a route",()=>{
 const r=summarizeTracking([point(0,0,{deviceId:'phone-a'}),point(1,.001,{deviceId:'phone-b'})]);
 assert.equal(r.distanceKm,0);assert.equal(r.gapSeconds,60);assert.equal(r.segments.length,2);
});
test("diagnostics are bounded and older phones remain compatible",()=>{
 const now=Date.now(),body={points:[],active:true,stateAt:new Date(now).toISOString()};
 assert.equal(api.validateUpload(body,now).diagnostics,null);
 const d=api.validateUpload({...body,diagnostics:{pending:3,rejectedFixes:9,accuracy:12.5,provider:'fused',version:'0.7',lastGpsAt:new Date(now-10000).toISOString(),token:'must-not-store'}},now).diagnostics;
 assert.equal(d.pending,3);assert.equal(d.accuracy,12.5);assert.equal(d.token,undefined);
 const bad=api.validateUpload({...body,diagnostics:{pending:-2,rejectedFixes:NaN,accuracy:Infinity,provider:'injected',version:'<script>',lastGpsAt:'bad'}},now).diagnostics;
 assert.equal(bad,null);
});

test('disconnect, phone failure and replacement retain asset location and every phone’s readings', async () => {
  const assetId=crypto.randomUUID();
  await db.query('INSERT INTO asset_register_items VALUES($1,$2,$3)',[assetId,'lifecycle-owner','Replacement test']);
  const pair=async()=>api.pairDevice((await api.createPairing('lifecycle-owner',assetId)).replaceAll('-',''),'Equipment phone');
  const old=await pair();
  const captured=Date.now()-60000;
  const reading=(time,longitude,accuracy=5)=>({id:crypto.randomUUID(),sessionId:crypto.randomUUID(),capturedAt:new Date(time).toISOString(),latitude:-33,longitude,accuracy,motion:'moving'});
  const upload=(points,active=true)=>api.validateUpload({points,active,stateAt:new Date().toISOString()});
  await api.ingestTracking(old.token,upload([reading(captured,18)]));
  await api.ingestTracking(old.token,upload([],false));
  let position=(await api.latestTrackingPositions('lifecycle-owner')).get(assetId);
  assert.equal(position.longitude,18);assert.equal(position.active,false);
  await assert.rejects(api.disconnectTrackingDevice('intruder',assetId),/ASSET_UNAVAILABLE/);
  await api.disconnectTrackingDevice('lifecycle-owner',assetId);
  position=(await api.latestTrackingPositions('lifecycle-owner')).get(assetId);
  assert.equal(position.longitude,18);assert.equal(position.connected_device_id,null);
  assert.equal(await api.trackingStatus('lifecycle-owner',assetId),null);
  await assert.rejects(api.ingestTracking(old.token,upload([])),/DEVICE_REVOKED/);
  // An unused pairing code must not hide the saved map location.
  await api.createPairing('lifecycle-owner',assetId);
  assert.equal((await api.latestTrackingPositions('lifecycle-owner')).get(assetId).longitude,18);
  const replacement=await pair();
  position=(await api.latestTrackingPositions('lifecycle-owner')).get(assetId);
  assert.equal(position.connected_device_id,replacement.deviceId);assert.equal(position.longitude,18);
  // Old and poor GPS fixes cannot replace the asset's reliable position.
  await api.ingestTracking(replacement.token,upload([reading(captured-20000,17),reading(captured+10000,19,100)]));
  assert.equal((await api.latestTrackingPositions('lifecycle-owner')).get(assetId).longitude,18);
  await api.ingestTracking(replacement.token,upload([reading(captured+20000,18.1)]));
  await db.query("UPDATE asset_tracking_devices SET last_seen_at=now()-interval '1 day' WHERE id=$1",[replacement.deviceId]);
  position=(await api.latestTrackingPositions('lifecycle-owner')).get(assetId);
  assert.equal(position.longitude,18.1);
  await api.disconnectTrackingDevice('lifecycle-owner',assetId);
  assert.equal((await api.latestTrackingPositions('lifecycle-owner')).get(assetId).longitude,18.1);
  const counts=await db.query('SELECT count(*)::int AS points,count(DISTINCT p.device_id)::int AS phones FROM asset_tracking_points p JOIN asset_tracking_devices d ON d.id=p.device_id WHERE d.asset_id=$1',[assetId]);
  assert.deepEqual(counts.rows[0],{points:4,phones:2});
  assert.equal((await api.latestTrackingPositions('intruder')).has(assetId),false);
});
