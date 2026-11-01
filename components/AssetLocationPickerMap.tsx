'use client';
import {useEffect,useRef,useState} from 'react';
import {loadLeaflet} from '../lib/asset-location-map';
import styles from './AssetLocationPickerMap.module.css';
type Props={latitude:string;longitude:string;onChange:(latitude:string,longitude:string)=>void};
export default function AssetLocationPickerMap({latitude,longitude,onChange}:Props){
 const node=useRef<HTMLDivElement>(null),runtime=useRef<any>(null),change=useRef(onChange),coordinates=useRef({latitude,longitude});
 change.current=onChange;coordinates.current={latitude,longitude};
 const [mode,setMode]=useState<'road'|'satellite'>('road'),[ready,setReady]=useState(false),[error,setError]=useState(''),[zoom,setZoom]=useState(5),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let cancelled=false;let map:any;let observer:ResizeObserver|undefined;setReady(false);setError('');
  loadLeaflet().then(L=>{
   if(cancelled||!node.current)return;
   map=L.map(node.current,{zoomControl:false,minZoom:2,maxZoom:19,scrollWheelZoom:false});
   const road=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{referrerPolicy: "strict-origin", maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'});
   const satellite=L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri'});
   const labels=L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Labels &copy; Esri'});
   const icon=L.divIcon({className:styles.marker,html:`<span class="${styles.pin}"><span></span></span>`,iconSize:[38,48],iconAnchor:[19,48]});
   let marker:any;
   const position=(a:number,b:number)=>{if(marker)marker.setLatLng([a,b]);else{marker=L.marker([a,b],{icon,draggable:true,title:'Asset location. Drag to reposition.',alt:'Asset location'}).addTo(map);marker.on('dragend',()=>{const point=marker.getLatLng();change.current(point.lat.toFixed(6),point.lng.toFixed(6));});}};
   const current=coordinates.current,a=Number(current.latitude),b=Number(current.longitude),has=current.latitude.trim()!==''&&current.longitude.trim()!==''&&Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a)<=90&&Math.abs(b)<=180;
   map.setView(has?[a,b]:[-29,25],has?15:5);if(has)position(a,b);
   map.on('click',(event:any)=>{position(event.latlng.lat,event.latlng.lng);change.current(event.latlng.lat.toFixed(6),event.latlng.lng.toFixed(6));});
   map.on('zoomend',()=>setZoom(map.getZoom()));
   runtime.current={map,road,satellite,labels,position};setZoom(map.getZoom());setReady(true);
   if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(()=>map.invalidateSize({pan:false}));observer.observe(node.current);}map.invalidateSize();
  }).catch(()=>{if(!cancelled)setError('The map could not load. Try again or enter coordinates below.');});
  return()=>{cancelled=true;observer?.disconnect();runtime.current=null;map?.remove();};
 },[attempt]);
 useEffect(()=>{const r=runtime.current;if(!ready||!r)return;[r.road,r.satellite,r.labels].forEach(layer=>{if(r.map.hasLayer(layer))r.map.removeLayer(layer);});if(mode==='satellite'){r.satellite.addTo(r.map);r.labels.addTo(r.map);}else r.road.addTo(r.map);},[mode,ready]);
 useEffect(()=>{const r=runtime.current,a=Number(latitude),b=Number(longitude);if(ready&&r&&latitude.trim()&&longitude.trim()&&Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a)<=90&&Math.abs(b)<=180)r.position(a,b);},[latitude,longitude,ready]);
 return <div className={styles.frame}>
  <div ref={node} className={styles.canvas} aria-label="Choose asset location on map"/>
  <div className={styles.layers} role="group" aria-label="Map style">{(['road','satellite'] as const).map(value=><button key={value} type="button" aria-pressed={mode===value} disabled={!ready} onClick={()=>setMode(value)}>{value==='road'?'Map':'Satellite'}</button>)}</div>
  <div className={styles.zoom} role="group" aria-label="Map zoom"><button type="button" aria-label="Zoom in" disabled={!ready||zoom>=19} onClick={()=>runtime.current?.map.zoomIn()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16"/></svg></button><button type="button" aria-label="Zoom out" disabled={!ready||zoom<=2} onClick={()=>runtime.current?.map.zoomOut()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16"/></svg></button></div>
  {!ready&&<div className={styles.status} role={error?'alert':'status'}>{error||'Loading map…'}{error&&<button type="button" onClick={()=>setAttempt(n=>n+1)}>Try again</button>}</div>}
  {ready&&<span className={styles.hint}>Click the map or drag the pin to set the location</span>}
 </div>;
}
