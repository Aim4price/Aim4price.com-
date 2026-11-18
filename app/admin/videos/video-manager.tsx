'use client';
import { useState } from 'react';
import Link from 'next/link';
import AdminSelect from '../../../components/AdminSelect';
import { tutorialCatalogue, tutorialPageHref, type TutorialAudience } from '../../../lib/tutorial-catalogue';
import type { VideoSlot } from '../../../lib/tutorial-videos';
import { youtubeEmbed } from '../../../lib/tutorial-video-policy';
import styles from './videos.module.css';
export default function VideoManager({initialSlots}:{initialSlots:VideoSlot[]}){
 const [slots,setSlots]=useState(initialSlots),[audience,setAudience]=useState<TutorialAudience>('owners'),[feature,setFeature]=useState('welcome'),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[confirm,setConfirm]=useState<'publish'|'unpublish'|'discard'|null>(null);
 const [link,setLink]=useState('');
 const [candidate,setCandidate]=useState('');
 const savedLink= (row:VideoSlot|undefined) => row?.draft_id ? row.draft_name : row?.published_name;
 const catalogue=tutorialCatalogue[audience],choices=[{id:'welcome',title:'Welcome video'},...catalogue.features];
 const selected=choices.find(x=>x.id===feature)!;
 const slot=slots.find(x=>x.audience===audience&&x.feature===feature),previewId=slot?.draft_id||slot?.published_id;
 const status=(row:VideoSlot|undefined)=>row?.draft_id?'Draft':row?.published_id?'Published':'No video';
 const choose=(id:string)=>{setFeature(id);setError('');setNotice('');setCandidate('');setLink('');setConfirm(null);};
 async function refresh(){setBusy(true);try{const r=await fetch('/api/admin/videos',{cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error);setSlots(data.slots);setError('');setCandidate('');setLink('');setConfirm(null);}catch(e){setError(e instanceof Error?e.message:'Unable to refresh.');}finally{setBusy(false);}}
 const embedded = candidate || youtubeEmbed(savedLink(slot) || '');
 function previewLink(event: React.FormEvent) {
  event.preventDefault();
  setError('');setNotice('');setConfirm(null);
  const url=youtubeEmbed(link);
  if(!url){setError('Paste a YouTube video link or its iframe embed code.');return;}
  setCandidate(url);
 }
 async function act(action:'link'|'publish'|'unpublish'|'discard'){
  setError('');setNotice('');setConfirm(null);setBusy(true);
  const params=new URLSearchParams({audience,feature,action,revision:String(slot?.revision||0)});
  if(action==='link')params.set('link',candidate);
  if(slot?.draft_id)params.set('draftId',slot.draft_id);
  try {
   const response=await fetch(`/api/admin/videos?${params}`,{method:'POST'});
   const data=await response.json();
   if(!response.ok)throw Error(data.error || 'Unable to save the video.');
   setSlots(data.slots);setCandidate('');setLink('');
   setNotice(action==='link'?'Draft saved. Publish when ready.':action==='publish'?'Published to the private guide.':action==='unpublish'?'Video unpublished.':'Draft discarded.');
  } catch(e){setError(e instanceof Error?e.message:'Unable to save the video.');}
  finally{setBusy(false);}
 }
 return <><section className={styles.toolbar}><label>Audience<AdminSelect value={audience} disabled={busy} onChange={event=>{setAudience(event.target.value as TutorialAudience);choose('welcome');setQuery('');}}>{Object.entries(tutorialCatalogue).map(([value,item])=><option key={value} value={value}>{item.label}</option>)}</AdminSelect></label><label>Find a feature<input type="search" value={query} disabled={busy} onChange={e=>setQuery(e.target.value)} placeholder="Search video topics"/></label><Link href={tutorialPageHref(audience)} target="_blank" rel="noopener noreferrer">Open guide</Link></section>
 <div className={styles.workspace}><aside className={styles.list}><h2>{catalogue.label}</h2><nav aria-label="Video topics">{choices.filter(x=>x.title.toLowerCase().includes(query.toLowerCase())).map(x=>{const row=slots.find(s=>s.audience===audience&&s.feature===x.id);return <button disabled={busy} key={x.id} aria-current={feature===x.id?'true':undefined} onClick={()=>choose(x.id)}><span>{x.id==='welcome'?'Welcome':`${choices.indexOf(x)}. ${x.title}`}</span><small>{status(row)}</small></button>;})}{!choices.some(x=>x.title.toLowerCase().includes(query.toLowerCase()))&&<p>No matching topics. Try another search.</p>}</nav></aside>
 <section className={styles.editor} aria-label="Selected video"><div className={styles.title}><div><p>{catalogue.label}</p><h2>{selected.title}</h2></div><span className={styles.badge}>{status(slot)}</span></div>
 <form onSubmit={previewLink} className={styles.linkForm}>
   <label htmlFor="tutorial-link">YouTube link or embed code</label>
   <div><input id="tutorial-link" disabled={busy} value={link} maxLength={4096}
     placeholder="Paste a YouTube link" onChange={e=>{setLink(e.target.value);setCandidate('');setConfirm(null);setError('');setNotice('');}}/>
     <button disabled={busy||!link.trim()}>Preview link</button></div>
 </form>
 {embedded ? <div className={styles.preview}>
   <iframe key={embedded} src={embedded} title={selected.title + ' preview'} allowFullScreen />
   <a href={`https://www.youtube.com/watch?v=${embedded.split('/').pop()}`} target="_blank" rel="noopener noreferrer">Watch on YouTube</a>
 </div> : previewId ? <video key={previewId} controls preload="metadata" src={`/api/tutorial-videos/${previewId}`} aria-label="Video preview"/> : null}
 {slot?.draft_id && slot.published_id && <p className={styles.help}>The current video stays live until you publish the replacement.</p>}
 {error&&<div className={styles.error} role="alert">{error} <button disabled={busy} onClick={()=>void refresh()}>Refresh videos</button></div>}
 {notice&&<p className={styles.notice} role="status">{notice}</p>}
 <div className={styles.actions}>
   {candidate && <button className={styles.primary} disabled={busy} onClick={()=>void act('link')}>Save draft</button>}
   {slot?.draft_id && <button className={styles.primary} disabled={busy||!!link.trim()} onClick={()=>setConfirm('publish')}>Publish video</button>}
   {slot?.published_id && <button disabled={busy||!!link.trim()} onClick={()=>setConfirm('unpublish')}>Unpublish</button>}
   {slot?.draft_id && <button disabled={busy||!!link.trim()} onClick={()=>setConfirm('discard')}>Discard draft</button>}
 </div>
 {confirm&&<section className={styles.confirm} aria-label="Confirm video change"><strong>{confirm==='publish'?`Publish ${selected.title}?`:confirm==='unpublish'?'Remove this video from the guide?':'Discard this draft?'}</strong><p>{confirm==='publish'?'This draft will replace the video shown on the private guide.':confirm==='unpublish'?'This video will be removed from the guide.':'The draft will no longer be selected. Any published video stays live.'}</p><div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={()=>void act(confirm)}>Confirm</button><button disabled={busy} onClick={()=>setConfirm(null)}>Cancel</button></div></section>}
 </section></div></>;
}
