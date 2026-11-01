import {sendMaintenanceReminderBatch,maintenanceReminderTestEnabled} from './maintenance-reminders';

/** Fast, single-account pilot. The normal daily rollout is deliberately not enabled here. */
export async function startMaintenanceReminderTestSender() {
  if(process.env.NODE_ENV!=='production'||!maintenanceReminderTestEnabled()) return;
  const state=globalThis as typeof globalThis & {aim4priceMaintenanceTestTimer?:ReturnType<typeof setInterval>};
  if(state.aim4priceMaintenanceTestTimer) return;
  let running=false;
  state.aim4priceMaintenanceTestTimer=setInterval(async()=>{
    if(running) return;
    running=true;
    try {
      const result=await sendMaintenanceReminderBatch();
      if(result.sent||result.failed) console.info('Maintenance email pilot batch',{sent:result.sent,failed:result.failed});
    } catch {console.warn('Maintenance email pilot unavailable; will retry.');}
    finally {running=false;}
  },60_000);
  state.aim4priceMaintenanceTestTimer.unref();
}
