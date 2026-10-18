"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from 'next/dynamic';
const LocationHistory = dynamic(() => import('./AssetLocationHistoryDialog'));
import TrackerInstallShareDialog from "./TrackerInstallShareDialog";
import styles from "./AssetTrackingPanel.module.css";
export default function AssetTrackingPanel({ assetId }: { assetId: string }) {
  const [showMovement,setShowMovement]=useState(false),[replace,setReplace]=useState(false),[title,setTitle]=useState('Tracked asset');
  const [expiresAt,setExpiresAt]=useState(0),[now,setNow]=useState(Date.now()),[copied,setCopied]=useState(false),[loading,setLoading]=useState(true);
  const pairingDevice=useRef<string|null|undefined>(undefined);
  const remaining=Math.max(0,Math.ceil((expiresAt-now)/1000));
  const [showInstallShare,setShowInstallShare]=useState(false);
  const [device, setDevice] = useState<any>(null),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
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
    <section className={`${styles.panel} ${styles.setupPanel}`} aria-label="Tracking device">
      {showMovement&&<LocationHistory assetId={assetId} title={title} initialTab="movement" onClose={()=>setShowMovement(false)}/>}
      {showInstallShare&&<TrackerInstallShareDialog onClose={()=>setShowInstallShare(false)}/>}
      <div className={styles.setupHeading}>
        <span className={styles.phoneIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10 5h4M10 18.5h4"/></svg></span>
        <div><h3>{device ? "Equipment phone" : "Connect your equipment phone"}</h3>
          <p>{device ? device.name : "Keep a phone on this asset to record its location and routes."}</p>
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
          <span className={styles.stepNumber}>1</span>
          <div className={styles.stepContent}>
            <h4>Install on phone</h4>
            <p>Share the installation link with the equipment’s Android phone.</p>
            <button type="button" className={styles.secondaryAction} aria-haspopup="dialog" onClick={()=>setShowInstallShare(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 13v7h16v-7"/></svg>
              Send installation link
            </button>
          </div>
        </div>
        <div className={styles.setupStep}>
          <span className={styles.stepNumber}>2</span>
          <div className={styles.stepContent}>
            <h4>{device ? "Connect a replacement" : "Connect phone"}</h4>
            <p>Create a code, enter it in the phone app, then tap Activate.</p>
            <button className={styles.primaryAction} disabled={busy} type="button" onClick={() => action("POST")}>
              {busy ? "Please wait…" : device ? "Pair replacement phone" : code ? "Create new code" : "Create pairing code"}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
      {code && (
        <div className={styles.pairingCard} aria-live="polite">
          <div className={styles.codeHeading}><strong>Your pairing code</strong><span>{remaining?`Expires in ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`:'Code expired'}</span></div>
          {remaining>0?<><output className={styles.pairingCode}>{code}</output><div className={styles.codeActions}><button type="button" onClick={()=>void copyCode()}>{copied?'Code copied':'Copy code'}</button><span role="status">Waiting for phone…</span></div></>:<p role="status">Create a new code to connect the phone.</p>}
          <p>Enter this code on the equipment phone. Pairing a replacement disconnects the previous phone.</p>
        </div>
      )}
      {device&&<button type="button" onClick={()=>setReplace(false)}>Back to connected phone</button>}
      </>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.setupFooter}>
        <p>Find recorded routes in <strong>Location history → Movement</strong>.</p>
        <a className={styles.helpLink} href="https://github.com/Aim4price/Aim4price.com-/blob/main/docs/asset-tracking-pilot.md" target="_blank" rel="noreferrer">Setup help <span aria-hidden="true">↗</span></a>
      </div>
      <details className={styles.setupDetails}>
        <summary>About this pilot</summary>
        <p>Records approximately every minute while moving. After 15 minutes stopped, saves a point every 10 minutes. After restarting the phone, open the app and tap Activate.</p>
      </details>
      {device && <details className={styles.setupDetails}><summary>Manage device</summary><div className={styles.disconnectRow}><button type="button" onClick={()=>setReplace(true)}>Replace phone</button><button className={styles.disconnectAction} disabled={busy} type="button" onClick={() => action("DELETE")}>Disconnect phone</button><span>Saved routes will remain.</span></div></details>}
    </section>
  );
}
