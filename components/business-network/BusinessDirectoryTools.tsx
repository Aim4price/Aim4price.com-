"use client";
import BusinessListingInvite, { type BusinessListingInviteProps } from "./BusinessListingInvite";
import styles from "./BusinessNetwork.module.css";

export default function BusinessDirectoryTools(props: BusinessListingInviteProps) {
  return (
    <section
      className={styles.directoryTools}
      aria-label="Business invitations"
    >
      <BusinessListingInvite {...props}/>
    </section>
  );
}
