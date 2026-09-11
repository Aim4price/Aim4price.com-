"use client";
import { useEffect, useState, useRef } from "react";
import BusinessLeadView from "../../../components/business-network/BusinessLeadView";
import type { BusinessLeadView as View } from "../../../lib/business-network-shared";
import styles from "../../../components/business-network/BusinessNetwork.module.css";
export default function RequestView() {
  const tokenRef = useRef("");
  const [token, setToken] = useState(""),
    [view, setView] = useState<View | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const t = tokenRef.current || location.hash.slice(1);
    tokenRef.current = t;
    history.replaceState(null, "", location.pathname);
    setToken(t);
    fetch("/api/business-network/request", {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setView(d.view);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <main className={`${styles.panel} ${styles.page}`}>
      <h1>Aim4price</h1>
      {view ? (
        <>
          <BusinessLeadView view={view} token={token} />
          <a className={styles.button} href={`mailto:${view.contact.email}`}>
            Email owner
          </a>
          <section className={styles.card}>
            <h2>More with Aim4price</h2>
            <p>
              Subscribe for reports and asset management tools. Owners control
              which additional information they share.
            </p>
            <a href="/register">Explore Aim4price</a>
          </section>
          <a href="/business-network/manage">Manage listing or stop requests</a>
        </>
      ) : (
        <p role="status">{error || "Loading enquiry…"}</p>
      )}
    </main>
  );
}
