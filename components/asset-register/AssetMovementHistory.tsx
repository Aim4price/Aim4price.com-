"use client";
import { useEffect, useMemo, useState } from "react";
import AssetLocationHistoryMap from "./AssetLocationHistoryMap";
import { downloadAssetMapReport } from "../../lib/asset-map-download";
import styles from "./AssetTrackingPanel.module.css";
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export default function AssetMovementHistory({ assetId }: { assetId: string }) {
  const [from, setFrom] = useState(today),
    [to, setTo] = useState(today),
    [report, setReport] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const url = `/api/asset-register/${encodeURIComponent(assetId)}/tracking/history?${new URLSearchParams({ from, to })}`;
  useEffect(() => {
    const c = new AbortController();
    setBusy(true);
    setReport(null);
    setError("");
    fetch(url, { signal: c.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (!c.signal.aborted) setReport(d);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setBusy(false);
      });
    return () => c.abort();
  }, [url, revision]);
  const segments = useMemo(() => report?.segments || [], [report]);
  const points = useMemo(
    () =>
      segments
        .flat()
        .map((p: any) => ({
          ...p,
          label: new Date(p.capturedAt).toLocaleString("en-ZA", {
            timeZone: "Africa/Johannesburg",
          }),
        })),
    [segments],
  );
  return (
    <section className={styles.panel}>
      <div className={styles.filters}>
        <label>
          From
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => setRevision((n) => n + 1)}
        >
          Refresh
        </button>
      </div>
      {busy ? (
        <p role="status">Loading movement…</p>
      ) : error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : (
        report && (
          <>
            <div className={styles.stats}>
              <div>
                <strong>{report.distanceKm.toFixed(2)} km</strong>
                <span>Recorded distance</span>
              </div>
              <div>
                <strong>{(report.movingSeconds / 3600).toFixed(2)} h</strong>
                <span>Moving time</span>
              </div>
              <div>
                <strong>
                  {(report.stationarySeconds / 3600).toFixed(2)} h
                </strong>
                <span>Stationary time</span>
              </div>
              <div>
                <strong>{report.averageMovingKmh.toFixed(1)} km/h</strong>
                <span>Moving average</span>
              </div>
              <div>
                <strong>{report.averageOverallKmh.toFixed(1)} km/h</strong>
                <span>Overall average</span>
              </div>
              <div>
                <strong>{Math.round(report.gapSeconds / 60)} min</strong>
                <span>Unobserved between readings</span>
              </div>
            </div>
            {points.length ? (
              <AssetLocationHistoryMap
                points={points}
                routeSegments={segments}
              />
            ) : (
              <p>
                No tracking readings in this period. Pair a phone in Advanced
                settings → Tracking device.
              </p>
            )}
            <div className={styles.actions}>
              <button
                type="button"
                disabled={!report.points.length}
                onClick={() =>
                  downloadAssetMapReport(url + "&format=xlsx", "xlsx").catch(
                    (e) => setError(e.message),
                  )
                }
              >
                Download movement report
              </button>
            </div>
            <p className={styles.notice}>
              South African dates. GPS estimates; moving time is not engine or
              working hours. Lines join recorded points, not surveyed paths.
              Gaps and separate recording sessions are not joined. After 15
              minutes without movement the phone reports Stopped.
            </p>
          </>
        )
      )}
    </section>
  );
}
