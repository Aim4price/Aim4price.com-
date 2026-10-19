import {summarizeTracking,type TrackingPoint} from './asset-tracking-math';
export type JourneyPoint=TrackingPoint & {sampleId:string;deviceId:string};
export type TrackingJourney={
 id:string;deviceId:string;sessionId:string;day:string;from:string;to:string;
 firstCapturedAt:string;lastCapturedAt:string;startAt:string;endAt:string;
 contextAt?:string;readings:number;kind:'journey'|'stationary'|'location';distanceKm:number;
 movingSeconds:number;stationarySeconds:number;gapBeforeSeconds:number;
};
const day=(v:string)=>new Date(Date.parse(v)+7200000).toISOString().slice(0,10);
/** Derive activities from immutable captures. Missing signal never proves a stop.
 * Every stored point belongs to exactly one entry; reports/deletes use exact bounds.
 */
export function trackingJourneys(input:JourneyPoint[]):TrackingJourney[]{
 const devices=new Map<string,JourneyPoint[]>();
 for(const p of input){const key=p.deviceId+'|'+p.sessionId;const list=devices.get(key)||[];list.push(p);devices.set(key,list);}
 const entries:TrackingJourney[]=[];
 for(const points of devices.values()){
  points.sort((a,b)=>Date.parse(a.capturedAt)-Date.parse(b.capturedAt)||a.sampleId.localeCompare(b.sampleId));
  const report=summarizeTracking(points);
  const indexes=new Map(points.map((p,i)=>[p.capturedAt,i]));
  const cuts=new Set<number>([0,points.length]);
  const gapAt=new Map<number,number>();
  for(const segment of report.segments.slice(1)){
   const i=indexes.get(segment[0].capturedAt)!;
   cuts.add(i);
   const acceptedIndex=report.readings.findIndex(p=>p.capturedAt===segment[0].capturedAt);
   if(acceptedIndex>0)gapAt.set(i,(Date.parse(segment[0].capturedAt)-Date.parse(report.readings[acceptedIndex-1].capturedAt))/1000);
  }
  for(const stop of report.stops){
   cuts.add(indexes.get(stop.from)!+1);
   cuts.add(indexes.get(stop.to)!+1);
  }
  const boundaries=[...cuts].filter(Number.isFinite).sort((a,b)=>a-b);
  for(let n=0;n<boundaries.length-1;n++){
   const start=boundaries[n],end=boundaries[n+1];
   if(start===end)continue;
   const own=points.slice(start,end),first=own[0],last=own.at(-1)!;
   const context=start>0&&!gapAt.has(start)?points[start-1]:null;
   const summary=summarizeTracking(context?[context,...own]:own);
   const parked=report.stops.some(s=>Date.parse(first.capturedAt)>Date.parse(s.from)&&Date.parse(last.capturedAt)<=Date.parse(s.to));
   entries.push({id:first.deviceId+'-'+first.sampleId,deviceId:first.deviceId,sessionId:first.sessionId,
    day:day((context||first).capturedAt),from:day((context||first).capturedAt),to:day(last.capturedAt),
    contextAt:context?.capturedAt,firstCapturedAt:(context||first).capturedAt,lastCapturedAt:last.capturedAt,startAt:first.capturedAt,endAt:last.capturedAt,
    readings:summary.readings.length,kind:summary.distanceKm>0?'journey':parked?'stationary':'location',
    distanceKm:summary.distanceKm,movingSeconds:summary.movingSeconds,stationarySeconds:summary.stationarySeconds,
    gapBeforeSeconds:gapAt.get(start)||0});
  }
 }
 return entries.sort((a,b)=>b.lastCapturedAt.localeCompare(a.lastCapturedAt)||b.id.localeCompare(a.id));
}
