export type TrackingPoint = {
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  sessionId: string;
};
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
    const sameSession = previous.sessionId === point.sessionId;
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
    // Use the adjacent accepted points for distance/time; anchor only rejects GPS drift.
    const travelled = distanceMeters(previous, point);
    distance += travelled;
    movingSeconds += seconds;
    maxSpeed = Math.max(maxSpeed, speed);
    const segment = segments[segments.length - 1];
    if (segment[segment.length - 1] !== previous) segment.push(previous);
    segment.push(point);
    previous = anchor = point;
  }
  finishStop();
  return {
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
