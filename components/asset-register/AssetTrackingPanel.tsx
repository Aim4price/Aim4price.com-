"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from 'next/dynamic';
const LocationHistory = dynamic(() => import('./AssetLocationHistoryDialog'));
import QrCodePreview from "../QrCodePreview";
import { trackerPairingUrl } from "../../lib/asset-tracking-links";
import TrackerInstallShareDialog from "./TrackerInstallShareDialog";
import styles from "./AssetTrackingPanel.module.css";
export default function AssetTrackingPanel({ assetId }: { assetId: string }) {
  const [showMovement,setShowMovement]=useState(false),[replace,setReplace]=useState(false),[title,setTitle]=useState('Tracked asset');
  const [expiresAt,setExpiresAt]=useState(0),[now,setNow]=useState(Date.now()),[copied,setCopied]=useState(false),[loading,setLoading]=useState(true);
  const pairingCardRef=useRef<HTMLDivElement>(null);
  const pairingDevice=useRef<string|null|undefined>(undefined);
  const remaining=Math.max(0,Math.ceil((expiresAt-now)/1000));
  const [showInstallShare,setShowInstallShare]=useState(false);
  const [device, setDevice] = useState<any>(null),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!code) return;
    const frame = requestAnimationFrame(() => {
      const card = pairingCardRef.current;
      if (!card) return;
      card.focus({ preventScroll: true });
      card.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
        inline: 'nearest',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [code]);
  const endpoint = `/api/asset-register/${encodeURIComponent(assetId)}/tracking`;
  useEffect(()=>{if(!code)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[code]);
  useEffect(() => {
    let gone = false;
    const refresh = () =>
      fetch(endpoint, { cache: "no-store" })
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw Error(d.error);
          if (!gone) { setDevice(d.device);setTitle(d.assetTitle||'Tracked asset');setError('');
            if(d.device && pairingDevice.current!==undefined && d.device.id!==pairingDevice.current){setCode('');setReplace(false);pairingDevice.current=undefined;}
          }
        })
        .catch((e) => {
          if (!gone) setError(e.message);
        }).finally(()=>{if(!gone)setLoading(false);});
    refresh();
    const timer = setInterval(refresh, 15000);
  return () => {
      gone = true;
      clearInterval(timer);
    };
  }, [endpoint]);
  async function action(method: "POST" | "DELETE") {
    if (
      method === "DELETE" &&
      !window.confirm(
        "Disconnect this tracking phone? Saved routes will remain.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(endpoint, { method });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setCode(d.code || "");setCopied(false);setNow(Date.now());setExpiresAt(Date.now()+(d.expiresInMinutes||15)*60000);
      if(method==='POST')pairingDevice.current=device?.id||null;
      if (method === "DELETE") {setDevice(null);setReplace(false);pairingDevice.current=undefined;}
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
    async function copyCode(){try{await navigator.clipboard.writeText(code);setCopied(true);}catch{setError('Select the pairing code and copy it manually.');}}
  if(loading)return <p role="status">Loading tracking device…</p>;
  return (
    <section className={`${styles.panel} ${styles.setupPanel}`} aria-label="Tracking device" data-tracker-setup>
      {showMovement&&<LocationHistory assetId={assetId} title={title} initialTab="movement" onClose={()=>setShowMovement(false)}/>}
      {showInstallShare&&<TrackerInstallShareDialog onClose={()=>setShowInstallShare(false)}/>}
      <div className={styles.setupHeading}>
        <span className={styles.phoneIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10 5h4M10 18.5h4"/></svg></span>
        <div><h3>{device ? "Equipment phone" : "Connect your phone"}</h3>
          <p>{device ? device.name : "Use the Android phone kept on this asset."}</p>
        </div>
        {device && <span className={styles.connectionStatus}>{device.status}</span>}
      </div>
      {device && !replace && <div className={styles.connectedSummary}>
        <strong>✓ Phone connected</strong>
        <p>{device.lastCapturedAt?'✓ First location received':'Waiting for the first location. Open the phone app, allow precise location and tap Activate.'}</p>
        <dl><div><dt>Last contact</dt><dd>{device.lastSeenAt?new Date(device.lastSeenAt).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'}):'Not received yet'}</dd></div>
        <div><dt>Last recorded location</dt><dd>{device.lastCapturedAt?`${Number(device.latitude).toFixed(5)}, ${Number(device.longitude).toFixed(5)}`:'Waiting for GPS'}</dd></div>
        {device.lastCapturedAt&&<div><dt>Location captured</dt><dd>{new Date(device.lastCapturedAt).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})}</dd></div>}</dl>
        <button type="button" className={styles.primaryAction} onClick={()=>setShowMovement(true)}>View movement →</button>
      </div>}
      {(!device||replace)&&<>
      <div className={styles.setupSteps}>
        <div className={styles.setupStep}>
          <div className={styles.stepLabel}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4"/></svg><span>Step 1</span></div>
          <div className={styles.stepContent}>
            <h4>Install Tracker</h4>
            <p>Send the app to your phone.</p>
            <button type="button" className={styles.secondaryAction} aria-haspopup="dialog" onClick={()=>setShowInstallShare(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 13v7h16v-7"/></svg>
              Share app link
            </button>
          </div>
        </div>
        <div className={styles.setupStep}>
          <div className={styles.stepLabel}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><path d="M7 7h3v3H7zm7 0h3v3h-3zM7 14h3v3H7zm7 0h3v3h-3z"/></svg><span>Step 2</span></div>
          <div className={styles.stepContent}>
            <h4>{device ? "Connect a replacement" : "Connect phone"}</h4>
            <p>Scan the code to link this asset.</p>
            <button className={styles.primaryAction} disabled={busy} type="button" onClick={() => action("POST")}>
              {busy ? "Please wait…" : device ? "Pair replacement phone" : code ? "Create new code" : "Create pairing code"}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
      {code && (
        <div ref={pairingCardRef} className={styles.pairingCard} tabIndex={-1} role="region" aria-label="Your pairing code">
          <div className={styles.codeHeading}><strong>Your pairing code</strong><span>{remaining?`Expires in ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`:'Code expired'}</span></div>
          {remaining>0?<><div className={styles.pairingLayout}><div className={styles.pairingQr}><QrCodePreview value={trackerPairingUrl(code)} label="Scan to connect the equipment phone"/></div><div><h4 className={styles.scanTitle}>Scan to connect</h4><p>Use the phone’s camera, open Tracker, then tap Connect.</p><output className={styles.pairingCode}>{code}</output><div className={styles.codeActions}><button type="button" onClick={()=>void copyCode()}>{copied?'Code copied':'Copy code'}</button><span role="status">Waiting for phone…</span></div></div></div></>:<p role="status">Create a new code to connect the phone.</p>}
          <p>Or enter this code in Tracker.{device && " Connecting replaces the current phone."}</p>
        </div>
      )}
      {device&&<button type="button" onClick={()=>setReplace(false)}>Back to connected phone</button>}
      </>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.setupFooter}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h8a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h8"/></svg><p>Routes: <strong>Location history → Movement</strong></p>
      </div>
      {device && <details className={styles.setupDetails}><summary>Manage device</summary><div className={styles.disconnectRow}><button type="button" onClick={()=>setReplace(true)}>Replace phone</button><button className={styles.disconnectAction} disabled={busy} type="button" onClick={() => action("DELETE")}>Disconnect phone</button><span>Saved routes will remain.</span></div></details>}
    </section>
  );
}
