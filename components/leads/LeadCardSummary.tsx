import type { ReactNode } from "react";
import styles from "../../app/leads/page.module.css";

import sharedStyles from "../../app/leads/shared-assets.module.css";

export default function LeadCardSummary({
  identity,
  actions,
  headerClassName = "",
  identityClassName = "",
}: {
  identity: ReactNode;
  actions: ReactNode;
  headerClassName?: string;
  identityClassName?: string;
}) {
  if (identity == null) return <div className={sharedStyles.detailActions}>{actions}</div>;
  return (
    <div className={styles.clientPanel}>
      <div className={`${styles.clientPanelHeader} ${headerClassName}`}>
        <div className={`${styles.clientIdentity} ${identityClassName}`}>
          {identity}
        </div>
        <div className={styles.clientDecisionArea}>{actions}</div>
      </div>
    </div>
  );
}
