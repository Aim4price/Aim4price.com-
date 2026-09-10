import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentPushIdentity, resolvePushAccess } from '../lib/push-access';
import { PUSH_APPS, type PushApp } from '../lib/push-policy';
import { getAssetDiscoveryEnquiryForUser } from '../lib/asset-discovery';
import { getMarketplaceSourcingRequestForAdvertiser } from '../lib/marketplace-sourcing-requests';
import { getDb } from '../lib/db';
import OwnerAppNav from '../app/owner-app/owner-app-nav';
import AppEnquiryDecision from './AppEnquiryDecision';
import styles from '../app/owner-app/owner-app.module.css';
import local from './AppNotifications.module.css';
function Contact({name,phone,email}:{name?:string;phone?:string;email?:string}) {
  const digits=(phone||'').replace(/[^\d+]/g,'');
  return <div className={local.actions}>{name?<strong>{name}</strong>:null}{digits?<a href={`tel:${digits}`}>{phone}</a>:null}{email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?<a href={`mailto:${encodeURIComponent(email)}`}>{email}</a>:null}</div>;
}
export default async function AppNotificationDetail({app,kind,id}:{app:PushApp;kind:'enquiry'|'sourcing';id:string}) {
  const root=PUSH_APPS[app].root,who=await currentPushIdentity();
  if(!who||who.app!==app)redirect(root+'/login');
  const access=await resolvePushAccess(who);
  if(!access)redirect(root+'/login');
  if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
  if(app==='owner'?!access.admin:kind==='sourcing'?!access.canSource:!access.canDiscover)notFound();
  let content;
  if(kind==='sourcing'){
    const request=await getMarketplaceSourcingRequestForAdvertiser({advertiserUserId:who.accountId,requestId:id});
    if(!request)notFound();
    content=<><h2>{request.title}</h2><p>{request.requesterName} asked for help finding this or similar equipment.</p>{request.message?<p>{request.message}</p>:null}<Contact name={request.requesterName} phone={request.requesterPhone} email={request.requesterEmail}/></>;
  }else{
    const enquiry=await getAssetDiscoveryEnquiryForUser({enquiryId:id,userId:who.accountId,accountType:app==='owner'?'owner':'dealer'}).catch(()=>null);
    if(!enquiry)notFound();
    const owned=app==='owner'&&access.admin?(await getDb().query('select id from asset_discovery_enquiries where id=$1::uuid and owner_user_id=$2',[id,who.accountId])).rows.length>0:false;
    const contact=owned?enquiry.requesterContact:enquiry.ownerContact;
    content=<><h2>{[enquiry.asset.brand,enquiry.asset.model].filter(Boolean).join(' ')}</h2><p>{enquiry.status==='approved'?'Enquiry approved':enquiry.status==='temporarily_denied'?'The owner is not interested at the moment.':enquiry.status==='pending'?'Enquiry awaiting a decision.':'This enquiry is no longer active.'}</p>{enquiry.requesterMessage?<p>{enquiry.requesterMessage}</p>:null}{contact?<Contact name={contact.businessName||contact.name} phone={contact.phone} email={contact.email}/>:null}{owned&&enquiry.status==='pending'?<AppEnquiryDecision id={id} licensing={enquiry.requesterAccountType==='licensing'}/>:null}</>;
  }
  return <main className={styles.page}>{app==='owner'?<OwnerAppNav backHref={root+'/notifications'} backLabel="Notifications"/>:null}<div className={`${styles.content} ${styles.notificationContent}`}><h1 className={styles.ownerPageTitle}>{kind==='sourcing'?'Sourcing request':'Discovery enquiry'}</h1><section className={styles.notificationCard}>{content}</section><div className={local.actions}><Link href={root+'/notifications'}>Back to notifications</Link></div></div></main>;
}
