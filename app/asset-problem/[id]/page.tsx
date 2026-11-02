import {getServerSession,isOwnerAppSession,isDealerAppSession} from '../../../lib/auth-session';
import {getAssetRegisterAccountAccess} from '../../../lib/asset-register-account-access';
import {getDb} from '../../../lib/db';
import {maintenanceAssetAvailable} from '../../../lib/maintenance-asset-lifecycle';
import {trackingEmailPermission} from '../../../lib/maintenance-email-access';
import {listIssueNotesForAssets} from '../../../lib/asset-issue-notes';
import {getAssetRegisterItemById} from '../../../lib/asset-register-db';
import SharedEnquiryAccess from '../../../components/SharedEnquiryAccess';
import styles from './page.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Asset problem | Aim4price',robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default async function Page({params}:{params:{id:string}}){
 const session=await getServerSession({requireActive:false,allowBusiness:true});
 if(!session?.user)return <main className={styles.page}><section className={styles.card}><h1>Sign in to view this problem</h1><SharedEnquiryAccess returnTo={`/asset-problem/${encodeURIComponent(params.id)}`} access="sign-in" embedded/></section></main>;
 const unavailable=<main className={styles.page}><section className={styles.card}><h1>Problem unavailable</h1><p>This problem may have been removed, or your access has changed.</p><a href="/">Open Aim4price</a></section></main>;
 if(!/^[0-9a-f-]{36}$/i.test(params.id)||isOwnerAppSession(session)||isDealerAppSession(session))return unavailable;
 const row=(await getDb().query('SELECT e.asset_id,e.photo_urls,a.user_id FROM asset_scan_events e JOIN asset_register_items a ON a.id=e.asset_id WHERE e.id=$1::uuid',[params.id])).rows[0];
 if(!row||!await maintenanceAssetAvailable(row.user_id,row.asset_id)||!await trackingEmailPermission(row.user_id,row.asset_id,session.user.id,'problem_logged'))return unavailable;
 if(row.user_id===session.user.id&&!await getAssetRegisterAccountAccess(session))return unavailable;
 const problem=(await listIssueNotesForAssets([row.asset_id],{includeNoted:true})).find(p=>p.id===params.id);
 const asset=await getAssetRegisterItemById(row.user_id,row.asset_id);
 if(!problem||!asset)return unavailable;
 return <main className={styles.page}><section className={styles.card}><p className={styles.status}>{problem.notedAtIso?'Resolved':'Open problem'}</p><h1>{asset.title}</h1><p>Reported by {problem.operatorName||'an asset team member'} · {new Date(problem.createdAtIso).toLocaleDateString('en-ZA',{timeZone:'Africa/Johannesburg'})}</p><div className={styles.note}>{problem.note}</div>{Array.isArray(row.photo_urls)&&row.photo_urls.filter((url:unknown):url is string=>typeof url==='string'&&(url.startsWith('https://')||url.startsWith('/')&&!url.startsWith('//'))).map((url:string)=><img key={url} src={url} alt="Photo attached to this problem" className={styles.photo}/>)}{problem.notedAtIso&&<p>Resolved on {new Date(problem.notedAtIso).toLocaleDateString('en-ZA',{timeZone:'Africa/Johannesburg'})}</p>}<a className={styles.button} href={row.user_id===session.user.id?'/asset-register':'/leads'}>{row.user_id===session.user.id?'Open asset register':'Open leads'}</a></section></main>;
}
