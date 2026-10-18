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
    <section className={styles.panel} aria-label="Tracking device">
      <p>
        <strong>{device ? device.name : "Connect an equipment phone"}</strong>
      </p>
      <p>
        {device
          ? `${device.status}${device.lastSeenAt ? " · Last connected " + new Date(device.lastSeenAt).toLocaleString("en-ZA") : ""}`
          : "Install Aim4price Tracker on the phone, enter a pairing code and activate tracking."}
      </p>
      <div className={styles.actions}>
        <a href="/downloads/aim4price-tracker-pilot.apk" download>
          Download Android pilot
        </a>
        <button disabled={busy} type="button" onClick={() => action("POST")}>
          {device ? "Pair replacement phone" : "Create pairing code"}
        </button>
        {device && (
          <button
            disabled={busy}
            type="button"
            onClick={() => action("DELETE")}
          >
            Disconnect
          </button>
        )}
      </div>
      {code && (
        <>
          <output className={styles.code}>{code}</output>
          <p className={styles.notice}>
            Valid for 15 minutes. Enter this on the equipment phone. Pairing a
            replacement disconnects the previous phone.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <p className={styles.notice}>
        Pilot: one-minute movement readings, ten-minute stationary readings.
        View routes under Location history → Movement. Installation
        instructions:{" "}
        <a
          href="https://github.com/Aim4price/Aim4price.com-/blob/main/docs/asset-tracking-pilot.md"
          target="_blank"
          rel="noreferrer"
        >
          Android setup
        </a>
        .
      </p>
    </section>
  );
}
