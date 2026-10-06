"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./AdminNavigation.module.css";

export type AdminSection =
  | "billing"
  | "accounts"
  | "businesses"
  | "maintenance-catalogue"
  | "dashboard"
  | "asset-values"
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
  {href:"/admin/asset-values",label:"Asset values",key:"asset-values"},
  { href: "/admin/billing", label: "Billing", key: "billing" },
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

const ADMIN_GROUPS: Array<{ title: string; keys: AdminSection[] }> = [
  { title: "Accounts & service", keys: ["accounts", "billing", "capture-queue", "work-tracker", "businesses"] },
  { title: "Assets & marketplace", keys: ["discovery", "marketplace", "sold-assets", "asset-map"] },
  { title: "Insights & tools", keys: ["dashboard", "valuations", "asset-values", "lifecycle", "maintenance-catalogue"] },
];

export default function AdminNavigation({ active, canGetEstimate = false, businessVerification, initialVerificationOpen = false }: {
  active: AdminSection;
  canGetEstimate?: boolean;
  businessVerification?: ReactNode;
  initialVerificationOpen?: boolean;
}) {
  const router = useRouter();
  const hasVerification = active === "businesses" && Boolean(businessVerification);
  const [isOpen, setIsOpen] = useState(initialVerificationOpen && hasVerification);
  const [showVerification, setShowVerification] = useState(initialVerificationOpen && hasVerification);
  const manageButtonRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLElement | null>(null);
  function closeManage() {
    setIsOpen(false);
    setShowVerification(false);
  }
  useEffect(() => {
    if (isOpen) modalRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, [showVerification, isOpen]);
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
        closeManage();
        return;
      }

      if (event.key !== "Tab" || !modal) return;

      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
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
      </button>

      {isOpen ? (
        <div className={styles.modalLayer}>
          <button
            type="button"
            className={styles.backdrop}
            tabIndex={-1}
            aria-label="Close Admin menu"
            onClick={closeManage}
          />
          <section
            ref={modalRef}
            className={`${styles.modal} ${showVerification ? styles.verificationModal : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-manage-modal-title"
            tabIndex={-1}
          >
            <header className={styles.modalHeader}>
              <h2 id="admin-manage-modal-title">{showVerification ? "Business verification" : "Manage"}</h2>
              <button
                type="button"
                className={styles.closeButton}
                aria-label="Close Admin menu"
                onClick={closeManage}
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>

            {showVerification && hasVerification ? (
              <div className={styles.verificationBody}>
                <button type="button" className={styles.backButton} onClick={() => setShowVerification(false)}>Back to Manage</button>
                {businessVerification}
              </div>
            ) : <div className={styles.navigationGroups}>
              {hasVerification || canGetEstimate ? <div className={styles.optionGrid}>
                {hasVerification ? (
                  <button type="button" className={styles.link} onClick={() => setShowVerification(true)}>
                    <strong>Business verification</strong>
                    <span aria-hidden="true">›</span>
                  </button>
                ) : null}
                {canGetEstimate ? (
                  <Link
                    href="/valuation"
                    prefetch={false}
                    className={styles.link}
                    onMouseEnter={() => router.prefetch("/valuation")}
                    onFocus={() => router.prefetch("/valuation")}
                    onClick={() => setIsOpen(false)}
                  >
                    <strong>Get estimate</strong>
                    <span aria-hidden="true">›</span>
                  </Link>
                ) : null}
              </div> : null}
              {ADMIN_GROUPS.map((group) => <section className={styles.navigationGroup} key={group.title} aria-label={group.title}>
                <h3>{group.title}</h3>
                <div className={styles.optionGrid}>
                  {group.keys.map((key) => ADMIN_LINKS.find((item) => item.key === key)!).map((item) => {
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
              </section>)}
            </div>}
          </section>
        </div>
      ) : null}
    </nav>
  );
}
