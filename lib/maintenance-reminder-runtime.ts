import {emailRollout,ensureAssetEmailDelivery,sendAssetEmailBatch} from './maintenance-email-delivery';
import {getDb} from './db';

// Kept as an alias for the existing instrumentation entry point.
export async function startMaintenanceReminderTestSender() {
  if(process.env.NODE_ENV!=='production'||!emailRollout().enabled) return;
  const state=globalThis as typeof globalThis & {aim4priceMaintenanceTestTimer?:ReturnType<typeof setInterval>};
  if(state.aim4priceMaintenanceTestTimer) return;
  let running=false;
  let cursor='';
  state.aim4priceMaintenanceTestTimer=setInterval(async()=>{
    if(running) return;
    running=true;
    try {
      const rollout=emailRollout();
      if(!rollout.enabled)return;
      await ensureAssetEmailDelivery();
      await getDb().query("INSERT INTO asset_email_worker(id,last_started_at) VALUES('sender',now()) ON CONFLICT(id) DO UPDATE SET last_started_at=now()");
      // South Africa is UTC+2 year-round. Activity alerts are checked all day.
      const includeReminders=rollout.test||new Date().getUTCHours()>=5;
      const result=await sendAssetEmailBatch(cursor,includeReminders);
      if(includeReminders)cursor=result.next||'';
      await getDb().query("UPDATE asset_email_worker SET last_finished_at=now(),last_error=NULL,last_sent=$1,last_failed=$2 WHERE id='sender'",[result.sent,result.failed]);
      console.info('Asset email worker batch',{mode:rollout.test?'pilot':'production',sent:result.sent,failed:result.failed,includeReminders,hasMore:!!result.next});
    } catch(error) {
      console.error('Asset email worker failed; will retry.',error);
      await getDb().query("UPDATE asset_email_worker SET last_error=$1 WHERE id='sender'",[error instanceof Error?error.message:'Worker failed']).catch(()=>{});
    } finally {running=false;}
  },60_000);
  state.aim4priceMaintenanceTestTimer.unref();
}
