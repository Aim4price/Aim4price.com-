import type { ReactNode } from "react";
import assetStyles from "../../app/asset-register/page.module.css";

export default function LeadAssetFacts({
  rows,
  statuses,
}: {
  rows: { label: string; value: ReactNode }[];
  statuses: ReactNode;
}) {
  return (
    <div className={assetStyles.assetDetailsGrid}>
      <div className={assetStyles.assetPrimaryDetails}>
        {rows.map((row) => (
          <div key={row.label} className={assetStyles.assetDetailRow}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
      <div className={assetStyles.assetStatusDetails}>{statuses}</div>
    </div>
  );
}
