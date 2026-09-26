"use client";
import BusinessListingInvite from "./BusinessListingInvite";
import styles from "./BusinessNetwork.module.css";

export default function BusinessDirectoryTools(props: {
  senderName?: string;
}) {
  return (
    <section
      className={styles.directoryTools}
      aria-label="Business invitations"
    >
      <BusinessListingInvite senderName={props.senderName}/>
    </section>
  );
}
