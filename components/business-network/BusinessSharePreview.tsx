"use client";
import { useEffect, useState } from "react";
import BusinessLeadView from "./BusinessLeadView";
import type { BusinessLeadView as View } from "../../lib/business-network-shared";
import styles from "./BusinessNetwork.module.css";
export default function BusinessSharePreview({
  payload,
  onReady,
}: {
  payload: Record<string, unknown>;
  onReady: (ready: boolean, id?: string) => void;
}) {
  const [view, setView] = useState<View | null>(null),
    [error, setError] = useState("");
  const serialized = JSON.stringify(payload);
  useEffect(() => {
    let active = true;
    onReady(false, String(payload.partnerUserId));
    setView(null);
    setError("");
    fetch("/api/business-network/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: serialized,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (active) {
          setView(d.view);
          onReady(true, String(payload.partnerUserId));
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [serialized, onReady]);
  return (
    <div className={styles.panel}>
      <h2>Review email share</h2>
      {view ? (
        <BusinessLeadView view={view} />
      ) : (
        <p role="status">{error || "Loading preview…"}</p>
      )}
    </div>
  );
}
