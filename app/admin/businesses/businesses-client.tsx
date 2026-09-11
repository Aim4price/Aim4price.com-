"use client";
import { useEffect, useState } from "react";
import AdminNavigation from "../../../components/AdminNavigation";
import BusinessInvite from "../../../components/business-network/BusinessInvite";
import adminStyles from "../page.module.css";
import layout from "./businesses.module.css";
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
  const visible = rows.filter((b) =>
    `${b.name} ${b.email} ${b.details.town || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <main className={adminStyles.page}>
      <section className={adminStyles.shell}>
        <header className={adminStyles.topBar}>
          <div className={adminStyles.titleBlock}>
            <h1>Business Directory</h1>
          </div>
          <div className={adminStyles.headerActions}>
            <AdminNavigation active="businesses" />
          </div>
        </header>
        <div className={layout.workspace}>
          {editing !== undefined ? (
            <>
              <button
                className={layout.secondary}
                type="button"
                onClick={() => setEditing(undefined)}
              >
                Back to businesses
              </button>
              <BusinessJoin
                adminMode
                adminBusiness={editing}
                onAdminSaved={() => {
                  setEditing(undefined);
                  setNotice("Business saved.");
                  void load();
                }}
              />
            </>
          ) : (
            <>
              <section className={layout.toolbar}>
                <label>
                  Find a business
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name, email or town"
                  />
                </label>
                <button
                  className={layout.primary}
                  type="button"
                  onClick={() => setEditing(null)}
                >
                  Add business manually
                </button>
              </section>
              <details className={layout.invitationTools}>
                <summary>Invitations and email enquiries</summary>
                <div className={layout.invitationBody}>
                  <BusinessInvite />
                </div>
              </details>
              {notice ? (
                <p role="status" className={styles.notice}>
                  {notice}
                </p>
              ) : null}
              {loading ? (
                <p role="status">Loading businesses…</p>
              ) : (
                <>
                  <p className={layout.count}>
                    {visible.length}{" "}
                    {visible.length === 1 ? "business" : "businesses"}
                  </p>
                  {visible.map((b) => (
                    <article className={layout.businessCard} key={b.id}>
                      <h2>{b.name}</h2>
                      <span className={layout.status}>
                        {b.status === "active"
                          ? "Published"
                          : b.status === "paused"
                            ? "Hidden"
                            : "Invited"}
                      </span>
                      <span>{b.details.town || "Location not added"}</span>
                      <span>{b.email}</span>
                      <button
                        className={layout.secondary}
                        type="button"
                        onClick={() => setEditing(b)}
                      >
                        Edit business
                      </button>
                    </article>
                  ))}
                  {!visible.length ? (
                    <p>
                      {search
                        ? "No businesses match your search."
                        : "No businesses added yet."}
                    </p>
                  ) : null}
                </>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
