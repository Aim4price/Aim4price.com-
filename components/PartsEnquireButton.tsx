"use client";
import type { ButtonHTMLAttributes } from "react";
import styles from "../app/dealer/parts/parts.module.css";

export function PartsMessageIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4h10a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H9l-6 4V8a4 4 0 0 1 4-4Z"/><path d="M8 9h8M8 13h5"/></svg>;
}

export default function PartsEnquireButton({ children = "Open", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} type="button" className={`${styles.partContactButton} ${styles.partEnquireButton}`}><span className={styles.partEnquireIcon}><PartsMessageIcon/></span>{children}</button>;
}
