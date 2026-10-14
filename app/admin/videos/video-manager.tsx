'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import AssetModalSelect from '../../../components/AssetModalSelect';
import { tutorialCatalogue, tutorialPageHref, type TutorialAudience } from '../../../lib/tutorial-catalogue';
import type { VideoSlot } from '../../../lib/tutorial-videos';
import { MAX_TUTORIAL_VIDEO_BYTES } from '../../../lib/tutorial-video-policy';
import styles from './videos.module.css';
export default function VideoManager({initialSlots}:{initialSlots:VideoSlot[]}){
 const [slots,setSlots]=useState(initialSlots),[audience,setAudience]=useState<TutorialAudience>('owners'),[feature,setFeature]=useState('welcome'),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState<number|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[previewed,setPreviewed]=useState<string|null>(null),[confirm,setConfirm]=useState<'publish'|'unpublish'|'discard'|null>(null);
 const fileInput=useRef<HTMLInputElement>(null);
 const catalogue=tutorialCatalogue[audience],choices=[{id:'welcome',title:'Welcome video'},...catalogue.features];
 const selected=choices.find(x=>x.id===feature)!;
 const slot=slots.find(x=>x.audience===audience&&x.feature===feature),previewId=slot?.draft_id||slot?.published_id;
 const status=(row:VideoSlot|undefined)=>row?.draft_id?'Draft':row?.published_id?'Published':'No video';
 const choose=(id:string)=>{setFeature(id);setError('');setNotice('');setPreviewed(null);setConfirm(null);};
 async function refresh(){setBusy(true);try{const r=await fetch('/api/admin/videos',{cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error);setSlots(data.slots);setError('');setPreviewed(null);setConfirm(null);}catch(e){setError(e instanceof Error?e.message:'Unable to refresh.');}finally{setBusy(false);}}
 async function act(action:'upload'|'publish'|'unpublish'|'discard',file?:File){
  setError('');setNotice('');setConfirm(null);
  if(file&&(!/\.(mp4|webm)$/i.test(file.name)||file.size>MAX_TUTORIAL_VIDEO_BYTES||!file.size)){setError('Choose an MP4 or WebM video up to 100 MB.');return;}
  setBusy(true);setProgress(file?0:null);
  const params=new URLSearchParams({audience,feature,action,revision:String(slot?.revision||0)});if(file)params.set('name',file.name);if(slot?.draft_id)params.set('draftId',slot.draft_id);
  try{
   const data=await new Promise<{slots:VideoSlot[]}>((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST',`/api/admin/videos?${params}`);xhr.timeout=600000;xhr.setRequestHeader('Content-Type',file?.type||'application/octet-stream');xhr.upload.onprogress=e=>{if(e.lengthComputable)setProgress(Math.round(e.loaded/e.total*100));};xhr.onerror=()=>reject(Error('Connection lost. Refresh to check whether the upload completed.'));xhr.ontimeout=()=>reject(Error('Upload timed out. Refresh to check the saved video before retrying.'));xhr.onload=()=>{try{const body=JSON.parse(xhr.responseText);if(xhr.status<200||xhr.status>=300)reject(Error(body.error||'Unable to save video.'));else resolve(body);}catch{reject(Error('Unable to read the result. Refresh and retry.'));}};xhr.send(file||null);});
   setSlots(data.slots);setPreviewed(null);setNotice(action==='upload'?'Draft uploaded. Preview it, then publish when ready.':action==='publish'?'Published to the private guide.':action==='unpublish'?'Video unpublished. It is available as a draft.':'Draft discarded. Any published video remains unchanged.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to save video.');}finally{setBusy(false);setProgress(null);if(fileInput.current)fileInput.current.value='';}
 }
 return <><section className={styles.toolbar}><AssetModalSelect label="Audience" value={audience} options={Object.entries(tutorialCatalogue).map(([value,x])=>({value,label:x.label}))} onChange={value=>{if(!busy){setAudience(value as TutorialAudience);choose('welcome');setQuery('');}}}/><label>Find a feature<input type="search" value={query} disabled={busy} onChange={e=>setQuery(e.target.value)} placeholder="Search video topics"/></label><Link href={tutorialPageHref(audience)} target="_blank" rel="noopener noreferrer">Open private page</Link></section>
 <div className={styles.workspace}><aside className={styles.list}><h2>{catalogue.label}</h2><nav aria-label="Video topics">{choices.filter(x=>x.title.toLowerCase().includes(query.toLowerCase())).map(x=>{const row=slots.find(s=>s.audience===audience&&s.feature===x.id);return <button disabled={busy} key={x.id} aria-current={feature===x.id?'true':undefined} onClick={()=>choose(x.id)}><span>{x.id==='welcome'?'Welcome':`${choices.indexOf(x)}. ${x.title}`}</span><small>{status(row)}</small></button>;})}{!choices.some(x=>x.title.toLowerCase().includes(query.toLowerCase()))&&<p>No matching topics. Try another search.</p>}</nav></aside>
 <section className={styles.editor} aria-label="Selected video"><div className={styles.title}><div><p>{catalogue.label}</p><h2>{selected.title}</h2></div><span className={styles.badge}>{status(slot)}</span></div>
 <p className={styles.help}>{slot?.draft_id&&slot.published_id?'A published video is still live. This replacement stays private to admins until you publish it.':'Upload a recording, check the preview, then publish it to the private guide.'}</p>
 {previewId?<><video key={previewId} controls preload="metadata" src={`/api/tutorial-videos/${previewId}`} onLoadedData={()=>setPreviewed(previewId)} onError={()=>{setPreviewed(null);setError('This video could not play. Try an MP4 exported with H.264 video and AAC audio.');}} aria-label="Video preview"/><p className={styles.filename}>{slot?.draft_id?slot.draft_name:slot?.published_name}</p></>:<div className={styles.placeholder}><strong>Your video will appear here</strong><span>MP4 or WebM · up to 100 MB</span></div>}
 <input ref={fileInput} type="file" accept="video/mp4,video/webm,.mp4,.webm" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void act('upload',file);}}/>
 {progress!==null&&<div role="status"><progress value={progress} max={100}/><p>{progress===100?'Saving your video…':`Uploading ${progress}%`}</p></div>}
 {error&&<div className={styles.error} role="alert">{error} <button disabled={busy} onClick={()=>void refresh()}>Refresh videos</button></div>}
 {notice&&<p className={styles.notice} role="status">{notice}</p>}
 <div className={styles.actions}><button disabled={busy} onClick={()=>fileInput.current?.click()}>{previewId?'Upload replacement':'Upload video'}</button>{slot?.draft_id&&<button className={styles.primary} disabled={busy||previewed!==slot.draft_id} onClick={()=>setConfirm('publish')}>Publish video</button>}{slot?.published_id&&<button disabled={busy} onClick={()=>setConfirm('unpublish')}>Unpublish</button>}{slot?.draft_id&&<button disabled={busy} onClick={()=>setConfirm('discard')}>Discard draft</button>}</div>
 {slot?.draft_id&&previewed!==slot.draft_id&&!error&&<p className={styles.help}>Wait for the preview to load and check the recording before publishing.</p>}
 {confirm&&<section className={styles.confirm} aria-label="Confirm video change"><strong>{confirm==='publish'?`Publish ${selected.title}?`:confirm==='unpublish'?'Remove this video from the guide?':'Discard this draft?'}</strong><p>{confirm==='publish'?'This draft will replace the video shown on the private guide.':confirm==='unpublish'?'The guide will show its video placeholder. Your recording remains saved.':'The draft will no longer be selected. Any published video stays live.'}</p><div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={()=>void act(confirm)}>Confirm</button><button disabled={busy} onClick={()=>setConfirm(null)}>Cancel</button></div></section>}
 </section></div></>;
}
