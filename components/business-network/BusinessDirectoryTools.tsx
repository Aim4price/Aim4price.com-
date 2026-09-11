"use client";
import BusinessFilters from "./BusinessFilters";
import BusinessInvite from "./BusinessInvite";
import styles from "./BusinessNetwork.module.css";

export default function BusinessDirectoryTools(props: {
  heading: string;
  service: string;
  onChange: (heading: string, service: string) => void;
}) {
  return (
    <section
      className={styles.directoryTools}
      aria-label="Business filters and invitations"
    >
      <BusinessFilters {...props} />
      <div className={styles.directoryActions}>
        <BusinessInvite />
      </div>
    </section>
  );
}
