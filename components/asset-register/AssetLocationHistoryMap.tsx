'use client';
import {useEffect,useRef,useState} from 'react';
import {loadLeaflet} from '../../lib/asset-location-map';
import styles from '../AssetLocationPickerMap.module.css';
type Props={points:Array<{latitude:number;longitude:number;label:string}>;routeSegments?:Array<Array<{latitude:number;longitude:number}>>};
export default function AssetLocationHistoryMap({points,routeSegments}:Props){
 const node=useRef<HTMLDivElement>(null),runtime=useRef<any>(null);
 const [mode,setMode]=useState<'road'|'satellite'>('road'),[ready,setReady]=useState(false),[error,setError]=useState(''),[zoom,setZoom]=useState(5),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let cancelled=false;let map:any;let observer:ResizeObserver|undefined;setReady(false);setError('');
  loadLeaflet().then(L=>{
   if(cancelled||!node.current)return;
   map=L.map(node.current,{zoomControl:false,minZoom:2,maxZoom:19,scrollWheelZoom:false});
   const road=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'});
   const satellite=L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri'});
   const labels=L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Labels &copy; Esri'});
   if(routeSegments){
    const renderer=L.canvas();
    routeSegments.forEach(segment=>{if(segment.length>1)L.polyline(segment.map(p=>[p.latitude,p.longitude]),{color:'#0f5840',weight:3,renderer}).addTo(map);});
    const stride=Math.max(1,Math.ceil(points.length/5000));
    points.forEach((p,i)=>{if(i%stride===0||i===points.length-1){const label=document.createElement('span');label.textContent=p.label;L.circleMarker([p.latitude,p.longitude],{radius:3,color:'#0f5840',fillOpacity:1,renderer}).addTo(map).bindPopup(label);}});
   } else points.forEach((point,index)=>{
    const icon=L.divIcon({className:styles.marker,html:`<span class="${styles.pin}" style="background:${index===0?'#0f5840':'#367b9c'}"><b style="transform:rotate(45deg);color:white;font:800 12px Arial">${index+1}</b></span>`,iconSize:[38,48],iconAnchor:[19,48]});
    const popup=document.createElement('div');popup.textContent=point.label;
    L.marker([point.latitude,point.longitude],{icon,zIndexOffset:points.length-index,title:point.label,alt:`Location ${index+1}`}).addTo(map).bindPopup(popup);
   });
   map.fitBounds(points.map(point=>[point.latitude,point.longitude]),{padding:[45,55],maxZoom:16});
   map.on('zoomend',()=>setZoom(map.getZoom()));
   runtime.current={map,road,satellite,labels};setZoom(map.getZoom());setReady(true);
   if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(()=>map.invalidateSize({pan:false}));observer.observe(node.current);}map.invalidateSize();
  }).catch(()=>{if(!cancelled)setError('The map could not load. Your recorded locations are listed below.');});
  return()=>{cancelled=true;observer?.disconnect();runtime.current=null;map?.remove();};
 },[attempt,points,routeSegments]);
 useEffect(()=>{const r=runtime.current;if(!ready||!r)return;[r.road,r.satellite,r.labels].forEach(layer=>{if(r.map.hasLayer(layer))r.map.removeLayer(layer);});if(mode==='satellite'){r.satellite.addTo(r.map);r.labels.addTo(r.map);}else r.road.addTo(r.map);},[mode,ready]);
 return <div className={styles.frame}>
  <div ref={node} className={styles.canvas} aria-label="Recorded asset locations"/>
  <div className={styles.layers} role="group" aria-label="Map style">{(['road','satellite'] as const).map(value=><button key={value} type="button" aria-pressed={mode===value} disabled={!ready} onClick={()=>setMode(value)}>{value==='road'?'Map':'Satellite'}</button>)}</div>
  <div className={styles.zoom} role="group" aria-label="Map zoom"><button type="button" aria-label="Zoom in" disabled={!ready||zoom>=19} onClick={()=>runtime.current?.map.zoomIn()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16"/></svg></button><button type="button" aria-label="Zoom out" disabled={!ready||zoom<=2} onClick={()=>runtime.current?.map.zoomOut()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16"/></svg></button></div>
  {!ready&&<div className={styles.status} role={error?'alert':'status'}>{error||'Loading map…'}{error&&<button type="button" onClick={()=>setAttempt(n=>n+1)}>Try again</button>}</div>}
  {ready&&<span className={styles.hint}>Select a point to see its date and details</span>}
 </div>;
}

