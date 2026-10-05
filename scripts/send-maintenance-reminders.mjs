// Called by a trusted scheduler. Never log the credential or recipient data.
const origin=process.env.AIM4PRICE_SITE_URL||'https://www.aim4price.com';
const secret=process.env.MAINTENANCE_REMINDER_SECRET;
if(!secret)throw Error('Configure MAINTENANCE_REMINDER_SECRET before running reminders.');
let after='';let sent=0,failed=0;
for(let batch=0;batch<500;batch++){
 const url=new URL('/api/internal/maintenance-reminders',origin);if(url.protocol!=='https:')throw Error('HTTPS is required.');if(after)url.searchParams.set('after',after);
 const response=await fetch(url,{method:'POST',headers:{authorization:`Bearer ${secret}`},redirect:'error',signal:AbortSignal.timeout(290000)});
 if(!response.ok)throw Error(`Reminder batch failed (${response.status}).`);
 const result=await response.json();sent+=result.sent;failed+=result.failed;
 if(!result.next){console.log(`Maintenance reminders: ${sent} accepted by email provider; ${failed} failed.`);if(failed)process.exitCode=1;break;}
 if(result.next===after)throw Error('Reminder cursor did not advance.');after=result.next;
 if(batch===499)throw Error('Reminder batch limit reached.');
}
