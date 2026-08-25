"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./AdminNavigation.module.css";

export type AdminSection =
  | "accounts"
  | "dashboard"
  | "marketplace"
  | "sold-assets"
  | "work-tracker"
  | "capture-queue"
  | "lifecycle";

const ADMIN_LINKS: Array<{
  key: AdminSection;
  href: string;
  label: string;
  description: string;
}> = [
  {
    href: "/admin",
    label: "Accounts",
    key: "accounts",
    description: "Manage users, access and account details",
  },
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    key: "dashboard",
    description: "Review Aim4price activity and platform totals",
  },
  {
    href: "/admin/marketplace",
    label: "Marketplace",
    key: "marketplace",
    description: "Review advertised value and listing history",
  },
  {
    href: "/admin/sold-assets",
    label: "Asset Outcomes",
    key: "sold-assets",
    description: "Manage sold, traded-in and scrapped assets",
  },
  {
    href: "/admin/work-tracker",
    label: "Work Tracker",
    key: "work-tracker",
    description: "Track and report Admin work",
  },
  {
    href: "/admin/capture-queue",
    label: "Capture Queue",
    key: "capture-queue",
    description: "Review assisted document capture",
  },
  {
    href: "/admin/lifecycle-calculator",
    label: "Lifecycle Model",
    key: "lifecycle",
    description: "Model ownership cost and lifecycle scenarios",
  },
];

export default function AdminNavigation({
  active,
}: {
  active: AdminSection;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const manageButtonRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLElement | null>(null);
  const activeLink =
    ADMIN_LINKS.find((item) => item.key === active) ?? ADMIN_LINKS[0];

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    const modal = modalRef.current;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      modal?.querySelector<HTMLElement>("button, a[href]")?.focus();
    });

    function keepFocusInsideManageModal(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key !== "Tab" || !modal) return;

      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) {
        event.preventDefault();
        modal.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", keepFocusInsideManageModal);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", keepFocusInsideManageModal);
      document.body.style.overflow = previousBodyOverflow;
      manageButtonRef.current?.focus();
    };
  }, [isOpen]);

  return (
    <nav className={styles.nav} aria-label="Admin navigation">
      <button
        ref={manageButtonRef}
        type="button"
        className={styles.manageButton}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
      >
        <span className={styles.manageIcon} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className={styles.manageCopy}>
          <strong>Manage</strong>
          <small>{activeLink.label}</small>
        </span>
        <span className={styles.manageChevron} aria-hidden="true">
          ⌄
        </span>
      </button>

      {isOpen ? (
        <div className={styles.modalLayer}>
          <button
            type="button"
            className={styles.backdrop}
            tabIndex={-1}
            aria-label="Close Admin menu"
            onClick={() => setIsOpen(false)}
          />
          <section
            ref={modalRef}
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-manage-modal-title"
            tabIndex={-1}
          >
            <header className={styles.modalHeader}>
              <div>
                <p>Aim4price admin</p>
                <h2 id="admin-manage-modal-title">Manage</h2>
                <span>Choose an Admin workspace.</span>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                aria-label="Close Admin menu"
                onClick={() => setIsOpen(false)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>

            <div className={styles.optionGrid}>
              {ADMIN_LINKS.map((item) => {
                const isActive = item.key === active;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`${styles.link} ${isActive ? styles.active : ""}`}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setIsOpen(false)}
                  >
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                    <em>{isActive ? "Current" : "Open"}</em>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </nav>
  );
}
