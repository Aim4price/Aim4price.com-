"use client";
import { useEffect, useState } from "react";
import BusinessJoin from "../../business-network/join/join-client";
import type { AdminBusiness } from "../../../lib/admin-business-network";
import styles from "../../../components/business-network/BusinessNetwork.module.css";
export default function AdminBusinesses() {
  const [rows, setRows] = useState<AdminBusiness[]>([]),
    [editing, setEditing] = useState<AdminBusiness | null | undefined>(
      undefined,
    ),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState("");
  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/business-network", {
          cache: "no-store",
        }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setRows(d.businesses);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to load businesses.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  if (editing !== undefined)
    return (
      <div>
        <div className={`${styles.page} ${styles.panel}`}>
          <button type="button" onClick={() => setEditing(undefined)}>
            Back to businesses
          </button>
        </div>
        <BusinessJoin
          adminMode
          adminBusiness={editing}
          onAdminSaved={() => {
            setEditing(undefined);
            setNotice("Business saved.");
            void load();
          }}
        />
      </div>
    );
  return (
    <main className={`${styles.page} ${styles.panel}`}>
      <a href="/admin">Back to Admin</a>
      <h1>Business directory</h1>
      <button
        className={styles.primary}
        type="button"
        onClick={() => setEditing(null)}
      >
        Add business manually
      </button>
      <p className={styles.muted}>
        Publish business details and a Google Maps link directly.
      </p>
      <label>
        Find a business
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, email or town"
        />
      </label>
      {notice ? (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      ) : null}
      {loading ? (
        <p role="status">Loading businesses…</p>
      ) : (
        rows
          .filter((b) =>
            `${b.name} ${b.email} ${b.details.town || ""}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((b) => (
            <article className={styles.card} key={b.id}>
              <h2>{b.name}</h2>
              <span>
                {b.details.town || "Location not added"} ·{" "}
                {b.status === "active"
                  ? "Published"
                  : b.status === "paused"
                    ? "Hidden"
                    : "Invited"}
              </span>
              <span>{b.email}</span>
              <button type="button" onClick={() => setEditing(b)}>
                Edit business
              </button>
            </article>
          ))
      )}
      {!loading && !rows.length ? <p>No businesses added yet.</p> : null}
    </main>
  );
}
