"use client";
import FriendlySelect from "../../app/account/friendly-select";
import {
  BUSINESS_HEADINGS,
  BUSINESS_SERVICES,
} from "../../lib/business-network-shared";
import styles from "./BusinessNetwork.module.css";

export default function BusinessFilters({
  heading,
  service,
  onChange,
}: {
  heading: string;
  service: string;
  onChange: (heading: string, service: string) => void;
}) {
  return (
    <div className={styles.filters}>
      <div className={styles.filterHeading}>
        <span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M4 17h16M9 4v6M15 14v6" />
          </svg>
          Find a business
        </span>
        {heading || service ? (
          <button type="button" onClick={() => onChange("", "")}>
            Clear filters
          </button>
        ) : null}
      </div>
      <FriendlySelect
        className={styles.directorySelect}
        label="Business heading"
        value={heading}
        onChange={(value) => onChange(value, service)}
        options={[
          { value: "", label: "All business headings" },
          ...BUSINESS_HEADINGS.map((value) => ({ value, label: value })),
        ]}
      />
      <FriendlySelect
        className={styles.directorySelect}
        label="Service"
        value={service}
        onChange={(value) => onChange(heading, value)}
        options={[
          { value: "", label: "All services" },
          ...BUSINESS_SERVICES.map((value) => ({ value, label: value })),
        ]}
      />
    </div>
  );
}
