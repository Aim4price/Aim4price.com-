"use client";
import type { ButtonHTMLAttributes } from "react";
import styles from "../app/dealer/parts/parts.module.css";

export function PartsMessageIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8 9 9 0 0 1-4-.9L3 20l1.4-4.7A8 8 0 1 1 20 11.5Z"/><path d="M8 10h8M8 14h5"/></svg>;
}

export default function PartsEnquireButton({ children = "Enquire", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} type="button" className={`${styles.partContactButton} ${styles.partEnquireButton}`}><PartsMessageIcon/>{children}</button>;
}
