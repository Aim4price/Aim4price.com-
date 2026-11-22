import { redirect } from 'next/navigation';
import { getAnyServerSession } from '../../../lib/auth-session';
import { getAccountProfile } from '../../../lib/account-profile';
import { ensureBillingSchema,listBillingPlans,subscribeOwnerTrial } from '../../../lib/billing';
import { money } from '../../../lib/billing-shared';
import { readTrialRegister } from '../../../lib/trial-register';
import { getDb } from '../../../lib/db';
import styles from '../../admin/billing/page.module.css';

async function trialAccount(){
  const session=await getAnyServerSession();
  if(!session?.user)redirect('/auth#login');
  const profile=await getAccountProfile(session.user);
  if(profile.accountType!=='owner'||profile.accountStatus==='suspended'||!profile.trialEndsAt)redirect('/account');
  return {user:session.user,end:profile.trialEndsAt};
}
export default async function OwnerTrialPage({searchParams}:{searchParams?:{review?:string}}){
  const {user,end}=await trialAccount();
  await ensureBillingSchema();
  const plans=(await listBillingPlans(true)).filter(p=>p.accountType==='owner');
  const ordered=(await getDb().query('select 1 from aim4price_billing_signup_jobs where user_id=$1',[user.id])).rowCount;
  const expired=new Date(end).getTime()<=Date.now();
  const assets=expired?await readTrialRegister(user.id):[];
  async function subscribe(form:FormData){
    'use server';
    const {user}=await trialAccount();
    const [key,version]=String(form.get('offer')??'').split(':');
    try { await subscribeOwnerTrial(user.id,{billingName:user.name,billingEmail:user.email,billingAddress:form.get('address'),billingAccepted:form.get('consent')==='on',planKey:key,billingPlanVersion:Number(version)}); } catch { redirect('/account/owner-trial?review=1'); }
    redirect('/account/owner-trial');
  }
  return <main className={styles.page}><section className={styles.panel}><h1>Owner trial</h1>
    <p>Your trial {expired?'ended':'ends'} on {new Date(end).toLocaleDateString('en-ZA',{timeZone:'Africa/Johannesburg'})}.</p>
    {searchParams?.review && <p role="alert">Review the current price and billing address. Contact Aim4price if your account has a billing hold.</p>}
    {ordered?<p>Your subscription invoice is scheduled. Aim4price will confirm activation after payment.</p>:plans.length?<form action={subscribe} className={styles.field}>
      <fieldset><legend>Choose an Owner subscription</legend>
      {plans.map(plan=><label key={plan.key} style={{display:'block',padding:8}}><input type="radio" name="offer" required style={{width:'auto'}} value={plan.key+':'+plan.version}/> {plan.description} · {money(plan.amountCents)} {plan.interval}</label>)}</fieldset>
      <p>Your first invoice is issued {expired?'after you subscribe':'when the trial ends'}.</p>
      <label>Billing address<input name="address" required maxLength={400}/></label>
      <label><input type="checkbox" required name="consent"/> I accept this subscription price and invoice.</label>
      <button className={styles.primary}>Subscribe</button>
    </form>:<a href="/contact-us">Contact Aim4price about subscribing</a>}
    {expired?<><h2>Your saved assets</h2><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Register</th><th>Asset</th><th>Serial</th><th>Year</th><th>Value</th></tr></thead><tbody>{assets.map((a,i)=><tr key={i}><td>{a.register}</td><td>{a.asset}</td><td>{a.serial}</td><td>{a.year}</td><td>{money(Math.round(a.valueExVat*100))}</td></tr>)}</tbody></table></div><a href="/account/owner-trial/export">Download register records</a></>:<a href="/asset-register">Open asset register</a>}
  </section></main>;
}
