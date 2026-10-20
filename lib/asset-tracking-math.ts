export type TrackingPoint = {
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  sessionId: string;
  deviceId?: string;
  sampleId?: string;
  context?: boolean;
  breakBefore?: boolean;
  receivedAt?: string;
  recoveredByDeviceId?: string;
};
export function visibleTrackingPoints<T extends TrackingPoint & {historyDeleted?:boolean}>(input:T[]):T[]{
 const removed=new Set<string>();
 return [...input].sort((a,b)=>Date.parse(a.capturedAt)-Date.parse(b.capturedAt)).flatMap(p=>{
  const key=(p.deviceId||'')+'|'+p.sessionId;
  if(p.historyDeleted){removed.add(key);return [];}
  const breakBefore=removed.delete(key)||p.breakBefore;
  return [{...p,breakBefore}];
 });
}
export function distanceMeters(a: TrackingPoint, b: TrackingPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad,
    dLon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
/** Capture times, not arrival times. Never bridge sessions, poor fixes or missing intervals. */
export function summarizeTracking(input: TrackingPoint[]) {
  const points = [...input].sort(
    (a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt),
  );
  const segments: TrackingPoint[][] = [];
  let distance = 0,
    movingSeconds = 0,
    stationarySeconds = 0,
    gapSeconds = 0,
    maxSpeed = 0;
  const readings: Array<TrackingPoint & {speedKmh: number | null}> = [];
  const stops: Array<{latitude:number;longitude:number;from:string;to:string;seconds:number}> = [];
  let stop: typeof stops[number] | null = null;
  const finishStop = () => { if (stop && stop.seconds >= 900) stops.push(stop); stop = null; };
  let previous: TrackingPoint | null = null,
    anchor: TrackingPoint | null = null;
  for (const point of points) {
    if (
      !Number.isFinite(Date.parse(point.capturedAt)) ||
      !Number.isFinite(point.latitude) ||
      !Number.isFinite(point.longitude) ||
      Math.abs(point.latitude) > 90 ||
      Math.abs(point.longitude) > 180 ||
      !Number.isFinite(point.accuracy) ||
      point.accuracy < 0 ||
      point.accuracy > 50
    ) {
      finishStop();
      previous = null;
      anchor = null;
      continue;
    }
    if (!previous || !anchor) {
      finishStop();
      readings.push({...point,speedKmh:null});
      segments.push([point]);
      previous = anchor = point;
      continue;
    }
    const seconds =
      (Date.parse(point.capturedAt) - Date.parse(previous.capturedAt)) / 1000;
    if (seconds <= 0) continue;
    const metres = distanceMeters(anchor, point),
      threshold = Math.max(10, anchor.accuracy, point.accuracy);
    const sameSession = previous.sessionId === point.sessionId && previous.deviceId === point.deviceId && !point.breakBefore;
    const stationary = metres <= threshold;
    if (!sameSession || seconds > (stationary ? 720 : 180)) {
      gapSeconds += seconds;
      finishStop();
      readings.push({...point,speedKmh:null});
      segments.push([point]);
      previous = anchor = point;
      continue;
    }
    if (stationary) {
      readings.push({...point,speedKmh:0});
      if (!stop) stop = {latitude:anchor.latitude,longitude:anchor.longitude,from:previous.capturedAt,to:point.capturedAt,seconds:0};
      stop.to = point.capturedAt; stop.seconds += seconds;
      stationarySeconds += seconds;
      previous = point;
      continue;
    }
    const speed = (distanceMeters(previous, point) / seconds) * 3.6;
    if (speed > 200) {
      gapSeconds += seconds;
      finishStop();
      readings.push({...point,speedKmh:null});
      segments.push([point]);
      previous = anchor = point;
      continue;
    }
    finishStop();
    readings.push({...point,speedKmh:speed});
    // Recover short slow-moving runs that only clear the GPS drift threshold after
    // several ten-second fixes. Never reclassify a long parked period as movement.
    const anchorSeconds=(Date.parse(point.capturedAt)-Date.parse(anchor.capturedAt))/1000;
    const shortRun=anchorSeconds>seconds&&anchorSeconds<=60;
    const travelled = shortRun?distanceMeters(anchor,point):distanceMeters(previous, point);
    distance += travelled;
    movingSeconds += shortRun?anchorSeconds:seconds;
    if(shortRun)stationarySeconds=Math.max(0,stationarySeconds-(anchorSeconds-seconds));
    maxSpeed = Math.max(maxSpeed, speed);
    const segment = segments[segments.length - 1];
    if (segment[segment.length - 1] !== previous) segment.push(previous);
    segment.push(point);
    previous = anchor = point;
  }
  finishStop();
  // Include intervals broken by rejected GPS fixes, too. Every second between
  // the first and last usable reading is observed movement, stationary, or unknown.
  const observedSpan = readings.length > 1
    ? (Date.parse(readings[readings.length-1].capturedAt)-Date.parse(readings[0].capturedAt))/1000 : 0;
  gapSeconds = Math.max(0,observedSpan-movingSeconds-stationarySeconds);
  const gaps=readings.flatMap((point,i)=>{
    if(!i||point.speedKmh!==null)return [];
    const before=readings[i-1];
    return [{from:before.capturedAt,to:point.capturedAt,seconds:(Date.parse(point.capturedAt)-Date.parse(before.capturedAt))/1000,
      reason:point.breakBefore?'Readings removed from history':before.sessionId!==point.sessionId||before.deviceId!==point.deviceId?'Recording changed':'Missing or unreliable GPS'}];
  });
  return {
    gaps,
    rejectedReadings:points.length-readings.length,
    points,
    readings,
    stops,
    segments,
    distanceKm: distance / 1000,
    movingSeconds,
    stationarySeconds,
    gapSeconds,
    maxSpeedKmh: maxSpeed,
    averageMovingKmh: movingSeconds ? (distance / movingSeconds) * 3.6 : 0,
    averageOverallKmh:
      movingSeconds + stationarySeconds
        ? (distance / (movingSeconds + stationarySeconds)) * 3.6
        : 0,
  };
}
