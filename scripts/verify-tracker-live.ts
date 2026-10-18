/** Run explicitly in a trusted Railway one-off job. Uses an isolated fixture and cleans it up. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {getDb} from '../lib/db';
import {createPairing,trackingStatus,latestTrackingPositions} from '../lib/asset-tracking';
import {trackerPairingUrl} from '../lib/asset-tracking-links';
import {summarizeTracking} from '../lib/asset-tracking-math';
const db=getDb(),id=randomUUID(),owner=`tracker-verification-${id}`,origin='https://www.aim4price.com';
async function post(path:string,body:unknown,token?:string){const response=await fetch(origin+path,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});return {status:response.status,data:await response.json()};}
try{
 await db.query(`INSERT INTO public.asset_register_items(id,user_id,kind,title,selected_method,plate_label) VALUES($1,$2,'manual','AUTOMATED TRACKER VERIFICATION — NOT REAL EQUIPMENT','manual',$3)`,[id,owner,`TEST-${id}`]);
 const code=await createPairing(owner,id);assert.match(code,/^[A-F0-9]{4}(?:-[A-F0-9]{4}){3}$/);assert.ok(trackerPairingUrl(code));
 const paired=await post('/api/tracking/pair',{code,name:'Automated database verification'});assert.equal(paired.status,200);assert.ok(paired.data.token);console.log('PASS real generated code -> QR payload -> live pairing API');
 assert.equal((await post('/api/tracking/pair',{code})).status,400);console.log('PASS pairing code cannot be reused');
 const now=Date.now(),sessionId=randomUUID();const points=Array.from({length:24},(_,i)=>({id:randomUUID(),sessionId,capturedAt:new Date(now-(25-i)*60000).toISOString(),latitude:-33.96+(i<4?i:i<21?3:i-17)*.0003,longitude:22.46+(i<4?i:i<21?3:i-17)*.0005,accuracy:5,motion:i>=4&&i<21?'stationary':'moving'}));
 const body={points,active:true,stateAt:new Date().toISOString()};const upload=await post('/api/tracking/points',body,paired.data.token);assert.equal(upload.status,200);assert.equal(upload.data.accepted.length,24);
 assert.equal((await post('/api/tracking/points',body,paired.data.token)).status,200);
 const rows=await db.query(`SELECT captured_at AS "capturedAt",latitude,longitude,accuracy,session_id AS "sessionId" FROM public.asset_tracking_points WHERE device_id=$1 ORDER BY captured_at`,[paired.data.deviceId]);assert.equal(rows.rowCount,24);console.log('PASS 24 readings persisted; retry does not duplicate readings');
 const status=await trackingStatus(owner,id);assert.ok(status?.lastCapturedAt);
 const latest=await latestTrackingPositions(owner);assert.ok(latest.has(id));assert.equal(Number(latest.get(id).latitude),points[23].latitude);console.log('PASS phone status and latest map position reflect stored readings');
 const report=summarizeTracking(rows.rows.map((r:any)=>({...r,capturedAt:new Date(r.capturedAt).toISOString()})));assert.ok(report.readings.length>0);assert.ok(report.stops.length>0);console.log('PASS database readings produce route dots and observed stop in movement report');
 await db.query('UPDATE public.asset_tracking_devices SET revoked_at=now() WHERE id=$1 AND owner_id=$2',[paired.data.deviceId,owner]);assert.equal((await post('/api/tracking/points',body,paired.data.token)).status,401);console.log('PASS disconnected device cannot upload');
 const expired=await createPairing(owner,id);await db.query("UPDATE public.asset_tracking_devices SET pair_expires_at=now()-interval '1 minute' WHERE asset_id=$1 AND owner_id=$2 AND paired_at IS NULL",[id,owner]);assert.equal((await post('/api/tracking/pair',{code:expired})).status,400);console.log('PASS expired code rejected');
 console.log('TRACKER LIVE DATABASE VERIFICATION PASSED');
}finally{
 await db.query('DELETE FROM public.asset_register_items WHERE id=$1 AND user_id=$2',[id,owner]);
 const remaining=await db.query('SELECT count(*) AS n FROM public.asset_tracking_devices WHERE asset_id=$1',[id]);assert.equal(Number(remaining.rows[0].n),0);console.log('PASS isolated test asset, device and readings cleaned up');await db.end();
}
