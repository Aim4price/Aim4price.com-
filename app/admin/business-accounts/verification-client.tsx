"use client";

import { useCallback, useEffect, useState } from "react";
import ReviewCard, { type BusinessVerificationAccount } from "./review-client";
import styles from "./verification.module.css";

export default function BusinessVerification() {
  const [accounts, setAccounts] = useState<BusinessVerificationAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("review");
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/business-accounts", { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load business accounts.");
      if (!signal?.aborted) setAccounts(data.accounts);
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : "Unable to load business accounts.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const needsReview = accounts.filter(a => !a.verified_at && a.account_status !== "suspended").length;
  const visible = accounts.filter(a => filter === "all" || (filter === "verified" ? !!a.verified_at && a.account_status !== "suspended" : filter === "suspended" ? a.account_status === "suspended" : !a.verified_at && a.account_status !== "suspended")).filter(a => `${a.business_name} ${a.email}`.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <div className={styles.review}>
      <p className={styles.intro}>Review free Business accounts. Confirm the email and business evidence before checking Business verified. An online listing alone does not prove ownership.</p>
      <div className={styles.filters} role="group" aria-label="Filter business verification">
        {[["review", `Needs review (${needsReview})`], ["verified", "Verified"], ["suspended", "Suspended"], ["all", "All accounts"]].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        <button type="button" disabled={loading} onClick={() => void load()}>{loading ? "Refreshing…" : "Refresh"}</button>
      </div>
      {accounts.length > 0 && <label className={styles.search}>Find an account<input type="search" placeholder="Business name or email" value={search} onChange={e => setSearch(e.target.value)} /></label>}
      {message && <p role="status">{message}</p>}
      {loading && <p role="status">Loading business accounts…</p>}
      {error && <div role="alert"><p>{error}</p><button className={styles.retry} type="button" onClick={() => void load()}>Try again</button></div>}
      {!loading && !error && !accounts.length && <p className={styles.empty}>No Business accounts found.</p>}
      {!loading && !error && accounts.length > 0 && !visible.length && <p>No accounts match this filter or search.</p>}
      {!loading && !error && visible.map(account => (
        <details key={account.user_id} className={styles.account}>
          <summary>
            <span className={styles.identity}><strong>{account.business_name || account.email}</strong><span>{account.email}</span></span>
            <span className={styles.status}>{account.account_status === "suspended" ? "Suspended" : account.verified_at ? "Verified" : "Needs review"}</span>
          </summary>
          <ReviewCard account={account} onSaved={() => { setMessage("Verification decision saved."); void load(); }} />
        </details>
      ))}
    </div>
  );
}
