"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "../../../components/business-network/BusinessNetwork.module.css";

export default function BusinessJoin() {
  const token = useRef("");
  const [business, setBusiness] = useState<{ name: string; status: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    token.current ||= location.hash.slice(1);
    if (!token.current) return;
    history.replaceState(null, "", location.pathname);
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/business-network/profile", {
          headers: { Authorization: `Bearer ${token.current}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load this listing.");
        setBusiness(data.business);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load this listing.");
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  async function stopRequests() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/business-network/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.current}` },
        body: JSON.stringify({ action: "pause" }),
      });
      if (!response.ok) throw new Error("Unable to stop requests. Please try again.");
      setBusiness(current => current && { ...current, status: "paused" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to stop requests.");
    } finally {
      setBusy(false);
    }
  }

  return <main className={`${styles.panel} ${styles.page}`}>
    <h1>Business accounts</h1>
    <p>The standalone business directory has closed.</p>
    <Link className={styles.primary} href="/business/join">Create a free account</Link>
    {business && <section className={styles.card}>
      <h2>{business.name}</h2>
      {business.status === "paused" ? <p role="status">Requests stopped.</p> :
        <button type="button" className={styles.button} disabled={busy} onClick={stopRequests}>{busy ? "Saving…" : "Stop listing requests"}</button>}
    </section>}
    {error && <p role="alert">{error}</p>}
  </main>;
}
