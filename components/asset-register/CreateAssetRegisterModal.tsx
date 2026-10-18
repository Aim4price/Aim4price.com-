'use client';
import { useEffect, useId, useRef, type FormEvent } from 'react';
import styles from '../../app/asset-registers/page.module.css';

export type RegisterDetailsDraft = { businessName: string; email: string; phone: string; addressLine1: string };
export default function CreateAssetRegisterModal({ draft, onChange, onSubmit, onClose, busy, error }: {
  draft: RegisterDetailsDraft; onChange: (draft: RegisterDetailsDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void; busy: boolean; error?: string;
}) {
 const titleId = useId(), form = useRef<HTMLFormElement>(null);
 useEffect(() => {
  const previous = document.activeElement as HTMLElement | null;
  form.current?.querySelector('input')?.focus();
  return () => { if (previous?.isConnected) previous.focus(); };
 }, []);
 return (<div
          className={styles.modalOverlay} data-website-overlay
          onKeyDown={event => {
 if (event.key === "Escape") { event.stopPropagation(); if (!busy) onClose(); }
 if (event.key !== "Tab") return;
 const nodes = Array.from(form.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),textarea:not(:disabled)") || []);
 const first = nodes[0], last = nodes[nodes.length - 1];
 if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
 else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
 }} role="dialog"
          aria-modal="true"
          aria-busy={busy}
          aria-labelledby={titleId}
        >
          <form ref={form}
            className={`${styles.modalCard} ${styles.accountRegisterModal} ${styles.createModalCard}`}
            onSubmit={onSubmit}
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 id={titleId}>Create a new asset register</h2>
                <p className={styles.modalIntro}>
                  Add the business details for the register. Only the business
                  name is required. Logos are added from the register card after creation.
                </p>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={onClose}
                disabled={busy}
                aria-label="Close add asset register modal"
              >
                ×
              </button>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Business name</span>
                <input
                  value={draft.businessName}
                  onChange={(event) =>
                    onChange({ ...draft, businessName: event.target.value })
                  }
                  placeholder="Example: Bashan Boerdery Pty Ltd"
                  required
                />
              </label>

              <label className={styles.field}>
                <span>Email</span>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(event) =>
                    onChange({ ...draft, email: event.target.value })
                  }
                  placeholder="accounts@example.co.za"
                />
              </label>

              <label className={styles.field}>
                <span>Phone</span>
                <input
                  type="tel"
                  value={draft.phone}
                  onChange={(event) =>
                    onChange({ ...draft, phone: event.target.value })
                  }
                  placeholder="082 000 0000"
                />
              </label>

              <label className={`${styles.field} ${styles.fullField}`}>
                <span>Address</span>
                <textarea
                  value={draft.addressLine1}
                  onChange={(event) =>
                    onChange({ ...draft, addressLine1: event.target.value })
                  }
                  placeholder="Farm, town, province"
                />
              </label>
            </div>

            {error ? <p role="alert">{error}</p> : null}
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalCancelButton}
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.modalPrimaryButton}
                disabled={busy}
              >
                {busy ? "Creating..." : "Create register"}
              </button>
            </div>
          </form>
        </div>);
}
