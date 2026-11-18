"use client";
import { useEffect, useState } from "react";
import DirectoryAdminAccess from "../../../components/business-network/DirectoryAdminAccess";
import BusinessInvite from "../../../components/business-network/BusinessInvite";
import layout from "./listing-reviews.module.css";
import BusinessJoin from "../../business-network/join/join-client";
import type { AdminBusiness } from "../../../lib/admin-business-network";
import styles from "../../../components/business-network/BusinessNetwork.module.css";
function ReviewControls() {
  const [rows, setRows] = useState<AdminBusiness[]>([]),
    [editing, setEditing] = useState<AdminBusiness>(),
    [notice, setNotice] = useState(""),
    [inviting, setInviting] = useState(""),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [search, setSearch] = useState("");
  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const r = await fetch("/api/admin/business-network", {
          cache: "no-store",
        }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setRows(d.businesses);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Unable to load businesses.");
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
                onAdminSaved={(published) => {
                  setEditing(undefined);
                  setNotice(published ? "Business approved and published. No invitation was sent." : "Business saved.");
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
                    data-search-input value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name, email or town"
                  />
                </label>
              </section>
              <details className={layout.invitationTools}>
                <summary>Acceptance link</summary>
                <div className={layout.invitationBody}>
                  <BusinessInvite />
                </div>
              </details>
              <DirectoryAdminAccess onAdd={setEditing} />
              {notice ? (
                <p role="status" className={styles.notice}>
                  {notice}
                </p>
              ) : null}
              {loadError ? <div role="alert" className={layout.emptyState}><p>{loadError}</p><button type="button" className={layout.secondary} onClick={() => void load()}>Try again</button></div> : null}
              {loading ? (
                <p role="status">Loading businesses…</p>
              ) : !loadError ? (
                <>
                  <p className={layout.count}>
                    {visible.length}{" "}
                    {visible.length === 1 ? "business" : "businesses"}
                  </p>
                  {visible.map((b) => (
                    <article className={layout.businessCard} key={b.id}>
                      {b.has_logo&&<img src={`/api/directory-logo/${b.id}`} alt={`${b.name} logo`} width={64} height={64} style={{objectFit:"contain",borderRadius:8}}/>}<h2>{b.name}</h2>
                      <span className={layout.status}>
                        {b.status === "active"
                          ? "Published"
                          : b.status === "paused"
                            ? "Hidden"
                            : "Awaiting publication"}
                      </span>
                      <span>{b.details.town || "Location not added"}</span>
                      <span>{b.email}</span><span>{b.details.services?.join(", ")}</span><span>{b.details.serviceArea}</span>
                      <button
                        className={layout.secondary}
                        type="button"
                        onClick={() => setEditing(b)}
                      >
                        Edit business
                      </button>
                      <button type="button" className={layout.secondary} disabled={Boolean(inviting)} onClick={async()=>{
                        setInviting(b.id);setNotice('');
                        try{const response=await fetch('/api/admin/business-network',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:b.id,action:b.status==='active'?'pause':'publish'})});const data=await response.json();if(!response.ok)throw new Error(data.error);setNotice(b.status==='active'?'Listing hidden.':'Business approved and published.');await load();}catch(error){setNotice(error instanceof Error?error.message:'Unable to update listing.');}finally{setInviting('');}
                      }}>{b.status==='active'?'Hide listing':'Approve and publish'}</button>
                    </article>
                  ))}
                  {!visible.length ? (
                    <div className={layout.emptyState}><p>
                      {search
                        ? "No businesses match your search."
                        : "No businesses added yet."}
                    </p>{search ? <button type="button" className={layout.secondary} onClick={() => setSearch("")}>Clear search</button> : <p>Review submitted listings here.</p>}</div>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </div>
  );
}

export default function ListingReviews() {
  const [opened, setOpened] = useState(false);
  return (
    <details className={layout.invitationTools} onToggle={event => {
      if (event.currentTarget.open) setOpened(true);
    }}>
      <summary>Listing reviews &amp; guest access</summary>
      {opened && <div className={layout.invitationBody}><ReviewControls /></div>}
    </details>
  );
}
