'use client';
import {useEffect,useRef,useState} from 'react';
import {loadLeaflet} from '../lib/asset-location-map';
import AssetActionIcon from './asset-register/AssetActionIcon';
import styles from '../app/asset-register/page.module.css';
export type AssetLocationValue={latitude:number|null;longitude:number|null;locationText:string|null};
export type AssetLocationUpdate={latitude:number;longitude:number;locationText:string;gpsAccuracyMeters:number|null;source:'device'|'manual'};
export default function AssetLocationEditor({location,onSave,viewMapHref}:{viewMapHref?:string;location:AssetLocationValue;onSave:(value:AssetLocationUpdate)=>Promise<void>}) {
 const [view,setView]=useState<'choice'|'manual'|'map'>('choice'),[lat,setLat]=useState(String(location.latitude??'')),[lng,setLng]=useState(String(location.longitude??'')),[note,setNote]=useState(location.locationText||''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const mapNode=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(view!=='map'||!mapNode.current)return;let cancelled=false;let map:any;
  loadLeaflet().then(L=>{if(cancelled||!mapNode.current)return;const has=lat!==''&&lng!=='';map=L.map(mapNode.current).setView(has?[Number(lat),Number(lng)]:[-29,25],has?15:5);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(map);let marker:any;
   const position=(a:number,b:number)=>{setLat(a.toFixed(6));setLng(b.toFixed(6));setSaved(false);if(marker)marker.setLatLng([a,b]);else{marker=L.marker([a,b],{draggable:true}).addTo(map);marker.on('dragend',()=>{const p=marker.getLatLng();setLat(p.lat.toFixed(6));setLng(p.lng.toFixed(6));setSaved(false)})}};
   if(has)position(Number(lat),Number(lng));map.on('click',(e:any)=>position(e.latlng.lat,e.latlng.lng));map.invalidateSize();
  }).catch(e=>{if(!cancelled)setError(e.message)});return()=>{cancelled=true;map?.remove()};
 // Coordinates are drafts; they must not recreate the map while its marker is dragged.
 },[view]);
 async function save(value:AssetLocationUpdate){setBusy(true);setError('');setSaved(false);try{await onSave(value);setLat(String(value.latitude));setLng(String(value.longitude));setSaved(true);setView('choice')}catch(e){setError(e instanceof Error?e.message:'Could not save location.')}finally{setBusy(false)}}
 function manualSave(){const a=Number(lat),b=Number(lng);if(!lat.trim()||!lng.trim()||!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a)>90||Math.abs(b)>180){setError('Enter valid latitude and longitude.');return}void save({latitude:a,longitude:b,locationText:note,gpsAccuracyMeters:null,source:'manual'})}
 function device(){if(!navigator.geolocation){setError('Location is unavailable on this device. Enter coordinates or choose on the map.');return}setBusy(true);setError('');navigator.geolocation.getCurrentPosition(p=>void save({latitude:p.coords.latitude,longitude:p.coords.longitude,gpsAccuracyMeters:p.coords.accuracy,source:'device',locationText:note}),()=>{setBusy(false);setError('Could not access device location. Allow location access, or enter coordinates manually.')},{enableHighAccuracy:true,timeout:15000,maximumAge:0})}
 return <section className={`${styles.assetSettingsSection} ${styles.assetSettingsLocationSection}`}>
 {view==='choice'?<><div className={styles.assetSettingsLocationCurrent}><div className={styles.assetSettingsLocationCurrentMain}><AssetActionIcon action="location" className={styles.assetSettingsOptionIcon}/><div><strong>{note||'Asset location'}</strong><p>{lat&&lng?`${lat}, ${lng}`:'No location saved yet.'}</p></div>{lat&&lng&&<a className={styles.assetSettingsMapLink} href={viewMapHref||`https://www.google.com/maps?q=${encodeURIComponent(lat+','+lng)}`} target={viewMapHref?undefined:"_blank"} rel="noreferrer">{viewMapHref?'View on asset map':'View map'}</a>}</div></div>
 <div className={styles.assetSettingsLocationChoiceGrid}>{[['device','Use device location'],['map','Choose on map'],['manual','Enter coordinates']].map(([mode,label])=><button type="button" className={styles.assetSettingsOptionButton} disabled={busy} key={mode} onClick={()=>{setError('');if(mode==='device')device();else setView(mode as 'manual'|'map')}}><AssetActionIcon action="location" className={styles.assetSettingsOptionIcon}/><span><strong>{busy&&mode==='device'?'Getting location…':label}</strong></span></button>)}</div></>:<><button className={styles.secondaryButton} type="button" disabled={busy} onClick={()=>setView('choice')}>Back</button>
 {view==='map'&&<div ref={mapNode} className={styles.assetSettingsMapCanvas} style={{height:'20rem'}} aria-label="Asset location map"/>}
 <div className={styles.assetSettingsStaticGrid}><label className={styles.assetSettingsField}><span>Latitude</span><input value={lat} inputMode="decimal" onChange={e=>{setLat(e.target.value);setSaved(false)}} onPaste={e=>{const pair=e.clipboardData.getData('text').trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);if(pair){e.preventDefault();setLat(pair[1]);setLng(pair[2])}}} placeholder="-33.924869"/></label><label className={styles.assetSettingsField}><span>Longitude</span><input value={lng} inputMode="decimal" onChange={e=>{setLng(e.target.value);setSaved(false)}} placeholder="18.424055"/></label></div>
 <label className={styles.assetSettingsField}><span>Optional location note</span><textarea rows={2} maxLength={180} value={note} onChange={e=>{setNote(e.target.value);setSaved(false)}} placeholder="Example: Main shed, north camp, client yard"/></label>
 <div className={styles.assetSettingsActions}><button className={styles.primaryButton} type="button" disabled={busy} onClick={manualSave}>{busy?'Saving…':'Save location'}</button></div></>}
 {error&&<p role="alert" className={styles.assetSettingsError}>{error}</p>}{saved&&<p role="status" className={styles.assetSettingsLocationSuccess}>Location saved to the asset.</p>}
 </section>;
}
