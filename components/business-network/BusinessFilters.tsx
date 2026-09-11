"use client";
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
    <div className={styles.panel}>
      <label>
        Business heading
        <select
          value={heading}
          onChange={(e) => onChange(e.target.value, service)}
        >
          <option value="">All business headings</option>
          {BUSINESS_HEADINGS.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <label>
        Service
        <select
          value={service}
          onChange={(e) => onChange(heading, e.target.value)}
        >
          <option value="">All services</option>
          {BUSINESS_SERVICES.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
