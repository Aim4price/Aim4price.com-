"use client";
import BusinessFilters from "./BusinessFilters";
import FindEnquiryBusiness from "./FindEnquiryBusiness";
import BusinessInvite from "./BusinessInvite";
import styles from "./BusinessNetwork.module.css";

export default function BusinessDirectoryTools(props: {
  onShare?: (recipient:{name:string;email:string;phone:string}) => void;
  heading: string;
  service: string;
  onChange: (heading: string, service: string) => void;
}) {
  return (
    <section
      className={styles.directoryTools}
      aria-label="Business filters and invitations"
    >
      {props.onShare && <FindEnquiryBusiness onShare={props.onShare}/>}
      <details className={styles.directoryDisclosure}>
        <summary>Filter businesses{props.heading || props.service ? <span>Active</span> : null}</summary>
        <BusinessFilters {...props} />
      </details>
      <details className={styles.directoryDisclosure}>
        <summary>Invitations &amp; history</summary>
        <div className={styles.directoryActions}><BusinessInvite /></div>
      </details>
    </section>
  );
}
