import type { ReactNode } from "react";
import styles from "./auth-polish.module.css";
import "./signup-cleanup.css";

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return <div className={styles.scope}>{children}</div>;
}