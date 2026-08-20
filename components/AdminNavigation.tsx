import Link from "next/link";
import styles from "./AdminNavigation.module.css";

export type AdminSection =
  | "accounts"
  | "dashboard"
  | "work-tracker"
  | "capture-queue"
  | "lifecycle";

const ADMIN_LINKS: Array<{
  key: AdminSection;
  href: string;
  label: string;
}> = [
  { key: "accounts", href: "/admin", label: "Accounts" },
  { key: "dashboard", href: "/admin/dashboard", label: "Dashboard" },
  { key: "work-tracker", href: "/admin/work-tracker", label: "Work Tracker" },
  { key: "capture-queue", href: "/admin/capture-queue", label: "Capture Queue" },
  { key: "lifecycle", href: "/admin/lifecycle-calculator", label: "Lifecycle Model" },
];

export default function AdminNavigation({
  active,
}: {
  active: AdminSection;
}) {
  return (
    <nav className={styles.nav} aria-label="Admin navigation">
      {ADMIN_LINKS.map((item) => {
        const isActive = item.key === active;

        return (
          <Link
            key={item.key}
            href={item.href}
            className={`${styles.link} ${isActive ? styles.active : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
