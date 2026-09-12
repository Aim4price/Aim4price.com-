"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./AdminNavigation.module.css";

export type AdminSection =
  | "accounts"
  | "businesses"
  | "maintenance-catalogue"
  | "dashboard"
  | "valuations"
  | "marketplace"
  | "asset-map"
  | "discovery"
  | "sold-assets"
  | "work-tracker"
  | "capture-queue"
  | "lifecycle";

const ADMIN_LINKS: Array<{
  key: AdminSection;
  href: string;
  label: string;
}> = [
  {
    href: "/admin",
    label: "Accounts",
    key: "accounts",
  },
  {
    href: "/admin/businesses",
    label: "Business Directory",
    key: "businesses",
  },
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    key: "dashboard",
  },
  {
    href: "/admin/valuations",
    label: "Valuations",
    key: "valuations",
  },
  {
    href: "/admin/marketplace",
    label: "Marketplace",
    key: "marketplace",
  },
  {
    href: "/admin/asset-map",
    label: "Asset Map",
    key: "asset-map",
  },
  {
    href: "/admin/discovery",
    label: "Discovery",
    key: "discovery",
  },
  {
    href: "/admin/sold-assets",
    label: "Outcomes",
    key: "sold-assets",
  },
  {
    href: "/admin/work-tracker",
    label: "Work Tracker",
    key: "work-tracker",
  },
  {
    href: "/admin/capture-queue",
    label: "Capture Queue",
    key: "capture-queue",
  },
  {
    href: "/admin/lifecycle-calculator",
    label: "Lifecycle Model",
    key: "lifecycle",
  },
  {
    href: "/admin/maintenance-catalogue",
    label: "Maintenance checklists",
    key: "maintenance-catalogue",
  },
];

export default function AdminNavigation({ active }: { active: AdminSection }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const manageButtonRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLElement | null>(null);
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
        <strong className={styles.manageCopy}>Manage</strong>
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
              <h2 id="admin-manage-modal-title">Manage</h2>
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
                    prefetch={false}
                    className={`${styles.link} ${isActive ? styles.active : ""}`}
                    aria-current={isActive ? "page" : undefined}
                    onMouseEnter={() => router.prefetch(item.href)}
                    onFocus={() => router.prefetch(item.href)}
                    onClick={() => setIsOpen(false)}
                  >
                    <strong>{item.label}</strong>
                    <span aria-hidden="true">›</span>
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
