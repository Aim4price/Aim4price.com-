import type { ReactNode } from "react";
import assetStyles from "../../app/asset-register/page.module.css";
import styles from "../../app/leads/page.module.css";

/** Shared by signed-in Leads and public enquiries. Controls and permitted data are supplied by each caller. */
export default function LeadAssetCard({
  identity,
  aside,
  children,
  className = "",
}: {
  identity: ReactNode;
  aside: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`${assetStyles.assetCard} ${styles.leadAssetCard} ${className} ${assetStyles.assetCardExpanded}`}
    >
      <div
        className={`${assetStyles.assetHeader} ${styles.leadAssetHeader} ${styles.expandedLeadHeader}`}
      >
        <div
          className={`${assetStyles.assetTitleBlock} ${styles.expandedLeadIdentity}`}
        >
          {identity}
        </div>
        <div
          className={`${assetStyles.assetHeaderAside} ${styles.leadAssetHeaderAside} ${styles.expandedLeadAside}`}
        >
          {aside}
        </div>
      </div>
      {children}
    </div>
  );
}
