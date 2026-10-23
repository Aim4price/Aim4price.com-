"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from 'next/dynamic';
const LocationHistory = dynamic(() => import('./AssetLocationHistoryDialog'));
import QrCodePreview from "../QrCodePreview";
import AssetAccessSettingsDialog from "./AssetAccessSettingsDialog";
import { trackerPairingUrl } from "../../lib/asset-tracking-links";
import TrackerInstallShareDialog from "./TrackerInstallShareDialog";
import styles from "./AssetTrackingPanel.module.css";
import AssetTrackingUsage from "./AssetTrackingUsage";
export default function AssetTrackingPanel({ assetId }: { assetId: string }) {
  const [showMovement,setShowMovement]=useState(false),[replace,setReplace]=useState(false),[title,setTitle]=useState('Tracked asset');
  const [expiresAt,setExpiresAt]=useState(0),[now,setNow]=useState(Date.now()),[copied,setCopied]=useState(false),[loading,setLoading]=useState(true);
  const pairingCardRef=useRef<HTMLDivElement>(null);
  const pairingDevice=useRef<string|null|undefined>(undefined);
  const remaining=Math.max(0,Math.ceil((expiresAt-now)/1000));
  const [showInstallShare,setShowInstallShare]=useState(false);
  const [showManage,setShowManage]=useState(false);
  const [confirmDisconnect,setConfirmDisconnect]=useState(false);
  const manageHeadingRef=useRef<HTMLHeadingElement>(null);
  const manageButtonRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(showManage)manageHeadingRef.current?.focus();},[showManage]);
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
    if(busy)return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(endpoint, { method });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setCode(d.code || "");setCopied(false);setNow(Date.now());setExpiresAt(Date.now()+(d.expiresInMinutes||15)*60000);
      if(method==='POST')pairingDevice.current=device?.id||null;
      if (method === "DELETE") {setDevice(null);setReplace(false);setShowManage(false);setConfirmDisconnect(false);pairingDevice.current=undefined;}
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
    async function copyCode(){try{await navigator.clipboard.writeText(code);setCopied(true);}catch{setError('Select the pairing code and copy it manually.');}}
  if(loading)return <p role="status">Loading tracking device…</p>;
  return (
    <section className={`${styles.panel} ${styles.setupPanel}`} aria-label="Tracking device" data-tracker-setup data-tracker-connected={device && !replace ? true : undefined}>
      {showMovement&&<LocationHistory assetId={assetId} title={title} initialTab="movement" onClose={()=>setShowMovement(false)}/>}
      {showInstallShare&&<TrackerInstallShareDialog onClose={()=>setShowInstallShare(false)}/>}
      {confirmDisconnect && <AssetAccessSettingsDialog locationLayout title="Disconnect phone?" assetTitle={title} onClose={()=>{if(!busy)setConfirmDisconnect(false);}}>
        <div className={styles.disconnectConfirm}>
          <div className={styles.disconnectWarning}>
            <span className={styles.disconnectIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="m9 9 6 6m0-6-6 6"/></svg></span>
            <div className={styles.disconnectCopy}>
              <strong>Tracking will stop</strong>
              <p>Connect this phone or a replacement with a new pairing code.</p>
            </div>
          </div>
          <p className={styles.savedRoutesNote}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>Your asset stays on the map. Its location and history are kept.</p>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <div className={styles.confirmActions}>
            <button type="button" className={styles.secondaryAction} disabled={busy} onClick={()=>setConfirmDisconnect(false)}>Cancel</button>
            <button type="button" className={styles.confirmDisconnectButton} disabled={busy} onClick={()=>void action("DELETE")}>{busy?'Disconnecting…':'Disconnect phone'}</button>
          </div>
        </div>
      </AssetAccessSettingsDialog>}
      <div className={styles.setupHeading}>
        <span className={styles.phoneIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10 5h4M10 18.5h4"/></svg></span>
        <div><h3>{device ? "Equipment phone" : "Connect your phone"}</h3>
          <p>{device ? device.name : "Use the Android phone kept on this asset."}</p>
        </div>
        {device && <span className={styles.connectionStatus}>{device.status}</span>}
      </div>
      {device && !replace && !showManage && <div className={styles.connectedSummary}>
        <div className={styles.connectedIntro}>
          <span className={styles.successIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 12 4 4 8-8"/></svg></span>
          <div><strong>Phone connected</strong><p>{device.lastCapturedAt?'Location received. View your route below.':'On the phone: allow precise location, then tap Activate outdoors.'}</p></div>
        </div>
        <dl className={styles.connectionFacts}>
          <div><dt>Last contact</dt><dd>{device.lastSeenAt?new Date(device.lastSeenAt).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg',dateStyle:'medium',timeStyle:'short'}):'Awaiting upload'}</dd></div>
          <div><dt>Latest GPS reading</dt><dd>{device.lastCapturedAt?new Date(device.lastCapturedAt).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg',dateStyle:'medium',timeStyle:'short'}):'Waiting for first location'}</dd></div>
        </dl>
        <details className={styles.trackingDiagnostics}><summary>Recording health</summary>
          <p>Latest saved accuracy: {typeof device.accuracy==='number'?'±'+Math.round(device.accuracy)+' m':'Not available'}</p>
          {device.diagnostics?<><p>Tracker {device.diagnostics.version||'Unknown version'} · {device.diagnostics.provider||'Unknown location source'}</p><p>Awaiting upload at last contact: {device.diagnostics.pending??'Unknown'} readings</p>{device.diagnostics.retained>0&&<p>{device.diagnostics.retained} readings retained on the phone for recovery or review.</p>}{typeof device.diagnostics.batteryPercent==='number'&&<p>Phone battery at last contact: {device.diagnostics.batteryPercent}%</p>}{device.diagnostics.backgroundLocation===0&&<p>Restart recovery needs location set to ‘Allow all the time’ on the phone.</p>}<p>Rejected GPS fixes since installation: {device.diagnostics.rejectedFixes??'Unknown'}</p></>:<p>This phone does not send recording diagnostics yet. Its tracker version cannot be verified remotely.</p>}
          <p>Last contact confirms an upload connection; latest GPS confirms a recorded location.</p>
        </details>
        <div className={styles.connectedActions}><button type="button" className={styles.primaryAction} onClick={()=>setShowMovement(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h8a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h8"/></svg>Routes &amp; reports</button>
        <button ref={manageButtonRef} type="button" className={styles.secondaryAction} onClick={()=>setShowManage(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor"/><circle cx="15" cy="17" r="3" fill="currentColor"/></svg>Manage device</button></div>
      </div>}
      {device && !replace && !showManage && <AssetTrackingUsage assetId={assetId}/>}
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

            </button>
          </div>
        </div>
      </div>
      {code && (
        <div ref={pairingCardRef} data-tracker-pairing className={styles.pairingCard} tabIndex={-1} role="region" aria-label="Your pairing code">
          <div className={styles.codeHeading}><strong>Your pairing code</strong><span>{remaining?`Expires in ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`:'Code expired'}</span></div>
          {remaining>0?<><div className={styles.pairingLayout}><div className={styles.pairingQr}><QrCodePreview value={trackerPairingUrl(code)} label="Scan to connect the equipment phone"/></div><div><h4 className={styles.scanTitle}>Scan to connect</h4><p>Use the phone’s camera, open Tracker, then tap Connect.</p><output className={styles.pairingCode}>{code}</output><div className={styles.codeActions}><button type="button" onClick={()=>void copyCode()}>{copied?'Code copied':'Copy code'}</button><span role="status">Waiting for phone…</span></div></div></div></>:<p role="status">Create a new code to connect the phone.</p>}
          <p>Or enter this code in Tracker.{device && " Connecting replaces the current phone."}</p>
        </div>
      )}
      {device&&<button type="button" onClick={()=>setReplace(false)}>Back to connected phone</button>}
      </>}
      {error && !confirmDisconnect && <p role="alert" className={styles.error}>{error}</p>}
      {!device && <div className={styles.setupFooter}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h8a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h8"/></svg><p>Routes: <strong>Location history → Tracking</strong></p>
      </div>}
      {device && showManage && <div className={styles.deviceManagement}>
        <button type="button" className={styles.manageBack} onClick={()=>{setShowManage(false);requestAnimationFrame(()=>manageButtonRef.current?.focus());}}>Back</button>
        <h4 ref={manageHeadingRef} tabIndex={-1}>Manage device</h4>
        <div className={styles.manageOptions}>
          <button type="button" className={styles.secondaryAction} disabled={busy} onClick={()=>{setShowManage(false);setReplace(true);}}>Replace phone</button>
          <button type="button" className={styles.disconnectAction} disabled={busy} onClick={()=>{setError("");setConfirmDisconnect(true);}}>{busy?'Please wait…':'Disconnect phone'}</button>
        </div>
        <p>Saved routes will remain.</p>
      </div>}
    </section>
  );
}
