import { redirect } from 'next/navigation';
import { getAnyServerSession } from '../../../lib/auth-session';
import { getAccountProfile } from '../../../lib/account-profile';
import { ensureBillingSchema,listBillingPlans,subscribeOwnerTrial } from '../../../lib/billing';
import { money } from '../../../lib/billing-shared';
import { getDb } from '../../../lib/db';
import styles from '../../admin/billing/page.module.css';

async function trialAccount(){
  const session=await getAnyServerSession();
  if(!session?.user)redirect('/auth#login');
  const profile=await getAccountProfile(session.user);
  if(profile.accountType!=='owner'||profile.accountStatus==='suspended'||!profile.trialEndsAt)redirect('/account');
  return {user:session.user,end:profile.trialEndsAt};
}
export default async function OwnerTrialPage(){
  const {user,end}=await trialAccount();
  await ensureBillingSchema();
  const plans=(await listBillingPlans(true)).filter(p=>p.accountType==='owner');
  const ordered=(await getDb().query('select 1 from aim4price_billing_signup_jobs where user_id=$1',[user.id])).rowCount;
  const expired=new Date(end).getTime()<=Date.now();
  const assets=expired?(await getDb().query(`select coalesce(nullif(to_jsonb(a)->>'title',''),nullif(to_jsonb(a)->>'asset_name',''),nullif(to_jsonb(a)->>'model_name',''),a.id::text) as title from asset_register_items a where user_id=$1 order by title`,[user.id])).rows:[];
  async function subscribe(form:FormData){
    'use server';
    const {user}=await trialAccount();
    await subscribeOwnerTrial(user.id,{billingName:user.name,billingEmail:user.email,billingAddress:form.get('address'),billingAccepted:form.get('consent')==='on',planKey:form.get('planKey'),billingPlanVersion:Number(form.get('version'))});
    redirect('/account/owner-trial');
  }
  return <main className={styles.page}><section className={styles.panel}><h1>Owner trial</h1>
    <p>Your trial {expired?'ended':'ends'} on {new Date(end).toLocaleDateString('en-ZA',{timeZone:'Africa/Johannesburg'})}.</p>
    {ordered?<p>Your subscription invoice is scheduled. Aim4price will confirm activation after payment.</p>:plans.length?plans.map(plan=><form key={plan.key} action={subscribe} className={styles.field}>
      <h2>{plan.description}</h2><strong>{money(plan.amountCents)} · {plan.interval}</strong>
      <p>Your first invoice is issued {expired?'after you subscribe':'when the trial ends'}.</p>
      <input type="hidden" name="planKey" value={plan.key}/><input type="hidden" name="version" value={plan.version}/>
      <label>Billing address<input name="address" required maxLength={400}/></label>
      <label><input type="checkbox" required name="consent"/> I accept this subscription price and invoice.</label>
      <button className={styles.primary}>Subscribe</button>
    </form>):<a href="/contact-us">Contact Aim4price about subscribing</a>}
    {expired?<><h2>Your saved assets</h2><ul>{assets.map((a,i)=><li key={i}>{a.title}</li>)}</ul><a href="/account/owner-trial/export">Download register records</a></>:<a href="/asset-register">Open asset register</a>}
  </section></main>;
}
