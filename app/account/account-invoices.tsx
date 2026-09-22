"use client";

import { useEffect, useState } from "react";
import InvoicePreviewButton from "../../components/InvoicePreview";
import { invoiceState, money, type BillingInvoice } from "../../lib/billing-shared";
import styles from "./page.module.css";

type InvoicePage = { invoices: BillingInvoice[]; total: number; preparing: boolean };

export default function AccountInvoices() {
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
        if (!controller.signal.aborted) setData(result);
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message || "Unable to load invoices."); });
    return () => controller.abort();
  }, [page, attempt]);

  if (error) return <div role="alert" className={styles.invoiceList}><p>{error}</p><button className={styles.ghostButton} onClick={() => setAttempt(value => value + 1)}>Try again</button></div>;
  if (!data) return <p role="status">Loading invoices…</p>;

  return <div className={styles.invoiceList}>
    {data.preparing ? <div role="status"><p>Your signup invoice is being prepared. It will also be emailed to your billing address.</p><button className={styles.ghostButton} onClick={() => setAttempt(value => value + 1)}>Refresh invoices</button></div> : null}
    {!data.invoices.length && !data.preparing ? <p>No invoices have been issued to your account.</p> : null}
    {data.invoices.map(invoice => <article key={invoice.id} className={styles.invoiceCard}>
      <div className={styles.invoiceHeading}><strong>{invoice.number}</strong><span>{invoiceState(invoice)}</span></div>
      <dl className={styles.invoiceDetails}>
        <div><dt>Due date</dt><dd>{invoice.dueDate}</dd></div>
        <div><dt>Total</dt><dd>{money(invoice.totalCents)}</dd></div>
        <div><dt>Paid</dt><dd>{money(invoice.paidCents)}</dd></div>
        <div><dt>Balance</dt><dd>{invoice.status === "void" ? "—" : money(invoice.totalCents - invoice.paidCents)}</dd></div>
      </dl>
      {invoice.status === "void" ? <p>{invoice.voidReason}</p> : <InvoicePreviewButton id={invoice.id} number={invoice.number} className={styles.ghostButton} />}
    </article>)}
    {page > 1 || page * 50 < data.total ? <nav className={styles.invoicePagination} aria-label="Invoice pages">
      <button className={styles.ghostButton} disabled={page === 1} onClick={() => { setData(null); setPage(value => value - 1); }}>Previous</button>
      <span>Page {page}</span>
      <button className={styles.ghostButton} disabled={page * 50 >= data.total} onClick={() => { setData(null); setPage(value => value + 1); }}>Next</button>
    </nav> : null}
    <p className={styles.invoiceHelp}>Payments appear after Aim4price verifies receipt. For queries, email <a href="mailto:Aim4price@gmail.com">Aim4price@gmail.com</a>.</p>
  </div>;
}
