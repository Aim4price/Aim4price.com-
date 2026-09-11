"use client";
import { useState } from "react";
import styles from "./BusinessNetwork.module.css";
type Entry = {
  id: string;
  name: string;
  title: string;
  umbrella: string;
  status: string;
  revoked_at: string | null;
};
export default function BusinessShareHistory() {
  const [open, setOpen] = useState(false),
    [rows, setRows] = useState<Entry[]>([]),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const r = await fetch("/api/business-network/history", {
        cache: "no-store",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setRows(d.requests);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to load.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.panel}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) void load();
        }}
      >
        Shared email enquiries
      </button>
      {open ? (
        <div className={styles.panel}>
          {notice ? <p role="status">{notice}</p> : null}
          {busy ? (
            <p>Loading…</p>
          ) : !rows.length ? (
            <p>No email enquiries yet.</p>
          ) : (
            rows.map((row) => (
              <div className={styles.card} key={row.id}>
                <strong>{row.umbrella || row.title}</strong>
                <span>
                  {row.name} · {row.revoked_at ? "Access revoked" : row.status}
                </span>
                {!row.revoked_at && row.status === "sent" ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await fetch("/api/business-network/history", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: row.id }),
                      });
                      if (r.ok) await load();
                      else
                        setNotice("Unable to revoke access. Please try again.");
                    }}
                  >
                    Revoke viewing link
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
