"use client";
import { useEffect, useState } from "react";
import styles from "./AssetTrackingPanel.module.css";
export default function AssetTrackingPanel({ assetId }: { assetId: string }) {
  const [device, setDevice] = useState<any>(null),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const endpoint = `/api/asset-register/${encodeURIComponent(assetId)}/tracking`;
  useEffect(() => {
    let gone = false;
    const refresh = () =>
      fetch(endpoint, { cache: "no-store" })
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw Error(d.error);
          if (!gone) setDevice(d.device);
        })
        .catch((e) => {
          if (!gone) setError(e.message);
        });
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
      setCode(d.code || "");
      if (method === "DELETE") setDevice(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={`${styles.panel} ${styles.setupPanel}`} aria-label="Tracking device">
      <div className={styles.setupHeading}>
        <span className={styles.phoneIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10 5h4M10 18.5h4"/></svg></span>
        <div><h3>{device ? "Equipment phone" : "Connect your equipment phone"}</h3>
          <p>{device ? device.name : "Keep a phone on this asset to record its location and routes."}</p>
        </div>
        {device && <span className={styles.connectionStatus}>{device.status}</span>}
      </div>
      {device?.lastSeenAt && <p className={styles.notice}>Last connected {new Date(device.lastSeenAt).toLocaleString("en-ZA")}</p>}
      <div className={styles.setupSteps}>
        <div className={styles.setupStep}>
          <span className={styles.stepNumber}>1</span>
          <div className={styles.stepContent}>
            <h4>Install the tracker</h4>
            <p>Download and install Aim4price Tracker on the equipment’s Android phone.</p>
            <a className={styles.secondaryAction} href="/downloads/aim4price-tracker-pilot.apk" download>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/></svg>
              Download Android app
            </a>
          </div>
        </div>
        <div className={styles.setupStep}>
          <span className={styles.stepNumber}>2</span>
          <div className={styles.stepContent}>
            <h4>{device ? "Connect a replacement" : "Connect this asset"}</h4>
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
          <div className={styles.codeHeading}><strong>Your pairing code</strong><span>Valid for 15 minutes</span></div>
          <output className={styles.pairingCode}>{code}</output>
          <p>Enter this code on the equipment phone. Pairing a replacement disconnects the previous phone.</p>
        </div>
      )}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.setupFooter}>
        <p>Find recorded routes in <strong>Location history → Movement</strong>.</p>
        <a className={styles.helpLink} href="https://github.com/Aim4price/Aim4price.com-/blob/main/docs/asset-tracking-pilot.md" target="_blank" rel="noreferrer">Setup help <span aria-hidden="true">↗</span></a>
      </div>
      <details className={styles.setupDetails}>
        <summary>About this pilot</summary>
        <p>Records approximately every minute while moving. After 15 minutes stopped, saves a point every 10 minutes. After restarting the phone, open the app and tap Activate.</p>
      </details>
      {device && <div className={styles.disconnectRow}><button className={styles.disconnectAction} disabled={busy} type="button" onClick={() => action("DELETE")}>Disconnect phone</button><span>Saved routes will remain.</span></div>}
    </section>
  );
}
