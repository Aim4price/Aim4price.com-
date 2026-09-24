"use client";
import BusinessFilters from "./BusinessFilters";
import BusinessListingInvite from "./BusinessListingInvite";
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
      <BusinessListingInvite/>
      <details className={styles.directoryDisclosure}>
        <summary>Filter businesses{props.heading || props.service ? <span>Active</span> : null}</summary>
        <BusinessFilters {...props} />
      </details>
    </section>
  );
}
