"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import styles from "./page.module.css";

export default function DashboardRefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button type="button" className={styles.refreshButton} disabled={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? "Refreshing…" : "Refresh dashboard"}</button>;
}
