'use client';
import {useEffect,useRef,useState} from 'react';
import {loadLeaflet} from '../../lib/asset-location-map';
import styles from '../AssetLocationPickerMap.module.css';
import routeStyles from './AssetLocationHistoryMap.module.css';
type Props={onSelectPoint?:(index:number)=>void;points:Array<{latitude:number;longitude:number;label:string}>;stops?:Array<{latitude:number;longitude:number;label:string}>;routeSegments?:Array<Array<{latitude:number;longitude:number}>>};
export default function AssetLocationHistoryMap({points,routeSegments,stops,onSelectPoint}:Props){
 const selectPoint=useRef(onSelectPoint);selectPoint.current=onSelectPoint;
 const node=useRef<HTMLDivElement>(null),runtime=useRef<any>(null);
 const [mode,setMode]=useState<'road'|'satellite'>('road'),[ready,setReady]=useState(false),[error,setError]=useState(''),[zoom,setZoom]=useState(5),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let cancelled=false;let map:any;let observer:ResizeObserver|undefined;setReady(false);setError('');
  loadLeaflet().then(L=>{
   if(cancelled||!node.current)return;
   map=L.map(node.current,{zoomControl:false,minZoom:2,maxZoom:19,scrollWheelZoom:false});
   const road=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{referrerPolicy: "strict-origin", maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'});
   const satellite=L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri'});
   const labels=L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Labels &copy; Esri'});
   if(routeSegments){
    const renderer=L.canvas({padding:.5});
    routeSegments.forEach(segment=>{if(segment.length>1)L.polyline(segment.map(p=>[p.latitude,p.longitude]),{color:'#176348',weight:4,opacity:.8,lineCap:'round',lineJoin:'round',renderer}).addTo(map);});
    const stride=Math.max(1,Math.ceil(points.length/5000));
    points.forEach((p,i)=>{if(i%stride===0||i===points.length-1){
     const label=document.createElement('span');label.textContent=p.label;
     const dot=L.circleMarker([p.latitude,p.longitude],{radius:4,color:'#fff',weight:1.5,fillColor:'#176348',fillOpacity:1,renderer}).addTo(map).bindPopup(label);
     dot.on('mouseover',()=>dot.setRadius(6));dot.on('mouseout',()=>dot.setRadius(4));
    }});
    const marker=(p:{latitude:number;longitude:number;label:string},text:string,kind:'start'|'end'|'stop'|'combined',number?:number)=>{
     const badge=document.createElement('div');badge.className=routeStyles.routeMarker;badge.dataset.kind=kind;
     const symbol=document.createElement('span');symbol.className=routeStyles.markerSymbol;symbol.setAttribute('aria-hidden','true');
     if(kind==='stop')symbol.textContent=String(number);
     else {const shape=document.createElement('i');shape.className=kind==='end'?routeStyles.endShape:routeStyles.startShape;symbol.append(shape);}
     const label=document.createElement('span');label.className=routeStyles.markerLabel;label.textContent=text;badge.append(symbol,label);
     const popup=document.createElement('span');popup.textContent=p.label;
     L.marker([p.latitude,p.longitude],{icon:L.divIcon({html:badge,className:routeStyles.markerRoot,iconSize:[26,26],iconAnchor:[13,13],popupAnchor:[0,-16]}),title:text,alt:text,zIndexOffset:kind==='stop'?1000:1100}).addTo(map).bindPopup(popup);
    };
    stops?.forEach((p,i)=>marker(p,'Stop '+(i+1),'stop',i+1));
    if(points.length){
     const first=points[0],last=points[points.length-1];
     if(points.length===1)marker(first,'Recorded location','combined');
     else if(first.latitude===last.latitude&&first.longitude===last.longitude)marker(first,'Start / End','combined');
     else {marker(first,'Start','start');marker(last,'End','end');}
    }
   } else points.forEach((point,index)=>{
    const icon=L.divIcon({className:styles.marker,html:`<span class="${styles.pin}" style="background:${index===0?'#0f5840':'#367b9c'}"><b style="transform:rotate(45deg);color:white;font:800 12px Arial">${index+1}</b></span>`,iconSize:[38,48],iconAnchor:[19,48]});
    const popup=document.createElement('div');popup.textContent=point.label;
    const marker=L.marker([point.latitude,point.longitude],{icon,zIndexOffset:points.length-index,title:point.label,alt:`Location ${index+1}`}).addTo(map);
    if(selectPoint.current)marker.on("click",()=>selectPoint.current?.(index));else marker.bindPopup(popup);
   });
   const fit=()=>{if(points.length)map.fitBounds(points.map(point=>[point.latitude,point.longitude]),{padding:[75,75],maxZoom:16});else map.setView([-29,24],5);};fit();
   map.on('zoomend',()=>setZoom(map.getZoom()));
   runtime.current={map,road,satellite,labels,fit};setZoom(map.getZoom());setReady(true);
   if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(()=>map.invalidateSize({pan:false}));observer.observe(node.current);}map.invalidateSize();
  }).catch(()=>{if(!cancelled)setError('The map could not load. Your recorded locations are listed below.');});
  return()=>{cancelled=true;observer?.disconnect();runtime.current=null;map?.remove();};
 },[attempt,points,routeSegments,stops]);
 useEffect(()=>{const r=runtime.current;if(!ready||!r)return;[r.road,r.satellite,r.labels].forEach(layer=>{if(r.map.hasLayer(layer))r.map.removeLayer(layer);});if(mode==='satellite'){r.satellite.addTo(r.map);r.labels.addTo(r.map);}else r.road.addTo(r.map);},[mode,ready]);
 return <div className={`${styles.frame} ${routeStyles.frame}`}>
  <div ref={node} className={styles.canvas} aria-label="Recorded asset locations"/>
  <div className={styles.layers} role="group" aria-label="Map style">{(['road','satellite'] as const).map(value=><button key={value} type="button" aria-pressed={mode===value} disabled={!ready} onClick={()=>setMode(value)}>{value==='road'?'Map':'Satellite'}</button>)}</div>
  <div className={`${styles.zoom} ${routeStyles.zoom}`} role="group" aria-label="Map zoom"><button type="button" aria-label="Zoom in" data-tooltip="Zoom in" disabled={!ready||zoom>=19} onClick={()=>runtime.current?.map.zoomIn()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16"/></svg></button><button type="button" aria-label="Zoom out" data-tooltip="Zoom out" disabled={!ready||zoom<=2} onClick={()=>runtime.current?.map.zoomOut()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16"/></svg></button><button type="button" aria-label="Show all points" data-tooltip="Show all points" disabled={!ready} onClick={()=>runtime.current?.fit()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg></button></div>
  {!ready&&<div className={styles.status} role={error?'alert':'status'}>{error||'Loading map…'}{error&&<button type="button" onClick={()=>setAttempt(n=>n+1)}>Try again</button>}</div>}
 </div>;
}

