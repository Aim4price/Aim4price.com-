"use client";

import { useEffect, useState } from "react";
import BillingInvoiceCard from "../../components/BillingInvoiceCard";
import { money, invoiceState, billingDate, type BillingInvoice } from "../../lib/billing-shared";
import styles from "./page.module.css";

type InvoicePage = { invoices: BillingInvoice[]; total: number; preparing: boolean };

export default function AccountInvoices() {
  const [expanded,setExpanded]=useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<InvoicePage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    void fetch(`/api/billing/invoices?page=${page}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Please sign in again to view your invoices.");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load invoices.");
        if (!controller.signal.aborted) { setData(result); setExpanded(result.invoices.map((invoice: BillingInvoice) => invoice.id)); }
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message || "Unable to load invoices."); });
    return () => controller.abort();
  }, [page, attempt]);

  if (error) return <div role="alert" className={styles.invoiceList}><p>{error}</p><button className={styles.ghostButton} onClick={() => setAttempt(value => value + 1)}>Try again</button></div>;
  if (!data) return <p role="status">Loading invoices…</p>;

  return <div className={styles.invoiceList}>
    {data.preparing ? <div role="status"><p>Your signup invoice is being prepared. It will also be emailed to your billing address.</p><button className={styles.ghostButton} onClick={() => setAttempt(value => value + 1)}>Refresh invoices</button></div> : null}
    {!data.invoices.length && !data.preparing ? <p>No invoices have been issued to your account.</p> : null}
    {data.invoices.length?<div className={styles.invoiceListToolbar}><span>{data.total} {data.total===1?'invoice':'invoices'}</span><button type="button" onClick={()=>setExpanded(expanded.length===data.invoices.length?[]:data.invoices.map(invoice=>invoice.id))}>{expanded.length===data.invoices.length?'Collapse all':'Expand all'}</button></div>:null}
    {data.invoices.map(invoice => <section key={invoice.id} className={styles.invoiceFold}>
      <button type="button" className={styles.invoiceFoldToggle} aria-expanded={expanded.includes(invoice.id)} aria-controls={`invoice-details-${invoice.id}`} onClick={()=>setExpanded(current=>current.includes(invoice.id)?current.filter(id=>id!==invoice.id):[...current,invoice.id])}>
        <span><strong>{invoice.number}</strong><small>Due {billingDate(invoice.dueDate)}</small></span><span className={styles.invoiceFoldAmount}><strong>{money(invoice.totalCents)}</strong><small>{invoiceState(invoice)}</small></span><span aria-hidden="true" className={styles.invoiceFoldChevron}>{expanded.includes(invoice.id)?'−':'+'}</span>
      </button>
      <div id={`invoice-details-${invoice.id}`} hidden={!expanded.includes(invoice.id)} className={styles.invoiceFoldBody}><BillingInvoiceCard invoice={invoice} embedded/></div>
    </section>)}
    {page > 1 || page * 50 < data.total ? <nav className={styles.invoicePagination} aria-label="Invoice pages">
      <button className={styles.ghostButton} disabled={page === 1} onClick={() => { setData(null); setExpanded([]); setPage(value => value - 1); }}>Previous</button>
      <span>Page {page}</span>
      <button className={styles.ghostButton} disabled={page * 50 >= data.total} onClick={() => { setData(null); setExpanded([]); setPage(value => value + 1); }}>Next</button>
    </nav> : null}
    <p className={styles.invoiceHelp}>Payments appear after Aim4price verifies receipt. For queries, email <a href="mailto:Aim4price@gmail.com">Aim4price@gmail.com</a>.</p>
  </div>;
}
