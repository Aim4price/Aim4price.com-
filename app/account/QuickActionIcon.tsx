import styles from "./page.module.css";
export type QuickActionIconName =
  | "connections"
  | "invoices"
  | "notifications"
  | "business"
  | "registers"
  | "claim"
  | "pin"
  | "fieldManager"
  | "ownerApp"
  | "dealer"
  | "marketplace"
  | "showroom"
  | "discovery"
  | "directory"
  | "security"
  | "reset";

export default function QuickActionIcon({ name }: { name: QuickActionIconName }) {
  const svgProps = {
    "aria-hidden": true,
    focusable: "false",
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
  } as const;

  const strokeProps = {
    stroke: "currentColor",
    strokeWidth: 1.85,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    vectorEffect: "non-scaling-stroke",
  } as const;

  return (
    <span className={styles.quickActionIcon} aria-hidden="true">
      {name === "notifications" ? (
        <svg {...svgProps}><path {...strokeProps} d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" /><path {...strokeProps} d="M10 21h4M12 2V1" /></svg>
      ) : name === "connections" ? (
        <svg {...svgProps}>
          <path {...strokeProps} d="m10 13 4-4m-6 6-1 1a3.54 3.54 0 0 1-5-5l4-4a3.54 3.54 0 0 1 5 0m2 2 1-1a3.54 3.54 0 0 1 5 5l-4 4a3.54 3.54 0 0 1-5 0" />
        </svg>
      ) : name === "business" ? (
        <svg {...svgProps}>
          <path
            d="M5.25 20.25h13.5V8.2L12 4.35 5.25 8.2v12.05Z"
            fill="currentColor"
            opacity="0.14"
          />
          <path {...strokeProps} d="M5.25 20.25V8.2L12 4.35l6.75 3.85v12.05" />
          <path {...strokeProps} d="M9 20.25v-5.4h6v5.4" />
          <path {...strokeProps} d="M9.2 10.1h.02" />
          <path {...strokeProps} d="M12 10.1h.02" />
          <path {...strokeProps} d="M14.8 10.1h.02" />
        </svg>
      ) : null}

      {name === "invoices" ? (
        <svg {...svgProps}><path {...strokeProps} d="M6 3h9l4 4v14H6V3Z M14 3v5h5 M9 12h7 M9 16h7" /></svg>
      ) : null}

      {name === "registers" ? (
        <svg {...svgProps}>
          <path
            d="M7 5.25h10a2 2 0 0 1 2 2v11.5H7a2 2 0 0 1-2-2V7.25a2 2 0 0 1 2-2Z"
            fill="currentColor"
            opacity="0.14"
          />
          <path
            {...strokeProps}
            d="M7 5.25h10a2 2 0 0 1 2 2v11.5H7a2 2 0 0 1-2-2V7.25a2 2 0 0 1 2-2Z"
          />
          <path {...strokeProps} d="M8.6 9h6.8" />
          <path {...strokeProps} d="M8.6 12.25h6.8" />
          <path {...strokeProps} d="M8.6 15.5h4.5" />
          <path {...strokeProps} d="M16.75 5.25V3.75" />
        </svg>
      ) : null}

      {name === "claim" ? (
        <svg {...svgProps}>
          <path d="M4.75 8.25 12 4l7.25 4.25v8.1L12 20.5l-7.25-4.15v-8.1Z" fill="currentColor" opacity="0.14" />
          <path {...strokeProps} d="M4.75 8.25 12 4l7.25 4.25v8.1L12 20.5l-7.25-4.15v-8.1Z" />
          <path {...strokeProps} d="m4.95 8.4 7.05 4.05 7.05-4.05M12 12.45v8" />
          <path {...strokeProps} d="M8.6 9.75 12 11.7l3.4-1.95" />
        </svg>
      ) : null}

      {name === "pin" ? (
        <svg {...svgProps}>
          <rect
            x="5"
            y="10"
            width="14"
            height="10"
            rx="2.25"
            fill="currentColor"
            opacity="0.14"
          />
          <rect
            {...strokeProps}
            x="5"
            y="10"
            width="14"
            height="10"
            rx="2.25"
          />
          <path {...strokeProps} d="M8.25 10V7.8a3.75 3.75 0 0 1 7.5 0V10" />
          <path {...strokeProps} d="M12 14.25v1.9" />
          <circle cx="12" cy="13.25" r="0.75" fill="currentColor" />
        </svg>
      ) : null}

      {name === "fieldManager" ? (
        <svg {...svgProps}>
          <circle
            cx="9"
            cy="8"
            r="3.15"
            fill="currentColor"
            opacity="0.14"
          />
          <circle {...strokeProps} cx="9" cy="8" r="3.15" />
          <path
            {...strokeProps}
            d="M3.9 19.25c.45-3.2 2.35-5.05 5.1-5.05 2.1 0 3.7 1.05 4.55 2.95"
          />
          <path
            {...strokeProps}
            d="M16.95 12.9a3.15 3.15 0 1 0 0 6.3 3.15 3.15 0 0 0 0-6.3Z"
          />
          <path {...strokeProps} d="m15.55 16.05.9.9 1.85-2" />
        </svg>
      ) : null}

      {name === "ownerApp" ? (
        <svg {...svgProps}>
          <rect
            x="5.5"
            y="3.25"
            width="13"
            height="17.5"
            rx="2.35"
            fill="currentColor"
            opacity="0.14"
          />
          <rect
            {...strokeProps}
            x="5.5"
            y="3.25"
            width="13"
            height="17.5"
            rx="2.35"
          />
          <circle {...strokeProps} cx="12" cy="9" r="2.05" />
          <path
            {...strokeProps}
            d="M8.65 15.5c.3-2.05 1.55-3.25 3.35-3.25s3.05 1.2 3.35 3.25"
          />
          <path {...strokeProps} d="M10.75 18.1h2.5" />
        </svg>
      ) : null}

      {name === "dealer" ? (
        <svg {...svgProps}>
          <path
            d="M4.75 19.25c.35-3.05 2.35-4.9 5.05-4.9s4.7 1.85 5.05 4.9H4.75Z"
            fill="currentColor"
            opacity="0.14"
          />
          <circle {...strokeProps} cx="9.8" cy="8.25" r="3.1" />
          <path {...strokeProps} d="M4.75 19.25c.35-3.05 2.35-4.9 5.05-4.9s4.7 1.85 5.05 4.9" />
          <path {...strokeProps} d="M15.6 9.25h3.65v7.25H15.6" />
          <path {...strokeProps} d="M17.4 12.9h.02" />
        </svg>
      ) : null}

      {name === "marketplace" ? (
        <svg {...svgProps}>
          <path
            d="M6.3 8.7h11.4l-.9 10.05H7.2L6.3 8.7Z"
            fill="currentColor"
            opacity="0.14"
          />
          <path {...strokeProps} d="M6.3 8.7h11.4l-.9 10.05H7.2L6.3 8.7Z" />
          <path {...strokeProps} d="M9 8.7a3 3 0 0 1 6 0" />
          <path {...strokeProps} d="M9.6 13.1h4.8" />
          <path {...strokeProps} d="M10.7 15.55h2.6" />
        </svg>
      ) : null}

      {name === "showroom" ? (
        <svg {...svgProps}>
          <path
            d="M4.25 9.4h15.5v10.35H4.25V9.4Z"
            fill="currentColor"
            opacity="0.14"
          />
          <path {...strokeProps} d="M4.25 9.4h15.5v10.35H4.25V9.4Z" />
          <path {...strokeProps} d="m3.5 9.4 1.7-4.15h13.6l1.7 4.15" />
          <path {...strokeProps} d="M8.1 19.75v-5.5h7.8v5.5M3.5 9.4h17" />
        </svg>
      ) : null}

      {name === "discovery" ? (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="7.7" fill="currentColor" opacity="0.14" />
          <circle {...strokeProps} cx="12" cy="12" r="7.7" />
          <path {...strokeProps} d="m9.2 14.8 1.65-4.15 4.15-1.65-1.65 4.15-4.15 1.65Z" />
          <path {...strokeProps} d="M12 4.3v1.2M12 18.5v1.2M4.3 12h1.2M18.5 12h1.2" />
        </svg>
      ) : null}

      {name === "directory" ? (
        <svg {...svgProps}>
          <path
            d="M12 21s6.7-4.8 6.7-11a6.7 6.7 0 1 0-13.4 0C5.3 16.2 12 21 12 21Z"
            fill="currentColor"
            opacity="0.14"
          />
          <path
            {...strokeProps}
            d="M12 21s6.7-4.8 6.7-11a6.7 6.7 0 1 0-13.4 0C5.3 16.2 12 21 12 21Z"
          />
          <circle {...strokeProps} cx="12" cy="10" r="2.35" />
          <path {...strokeProps} d="M8.4 18.55h7.2" />
        </svg>
      ) : null}

      {name === "security" ? (
        <svg {...svgProps}>
          <path
            d="M6.2 10.15V8.1a5.8 5.8 0 0 1 11.6 0v2.05"
            fill="currentColor"
            opacity="0.14"
          />
          <rect
            x="4.8"
            y="10.15"
            width="14.4"
            height="10"
            rx="2.4"
            fill="currentColor"
            opacity="0.14"
          />
          <path {...strokeProps} d="M7.8 10.15V8.1a4.2 4.2 0 0 1 8.4 0v2.05" />
          <rect {...strokeProps} x="4.8" y="10.15" width="14.4" height="10" rx="2.4" />
          <circle cx="12" cy="14.65" r="1.05" fill="currentColor" />
          <path {...strokeProps} d="M12 15.7v1.35" />
        </svg>
      ) : null}

      {name === "reset" ? (
        <svg {...svgProps}>
          <rect
            x="3.75"
            y="5.5"
            width="16.5"
            height="13"
            rx="2.35"
            fill="currentColor"
            opacity="0.14"
          />
          <rect {...strokeProps} x="3.75" y="5.5" width="16.5" height="13" rx="2.35" />
          <path {...strokeProps} d="m5.25 7.35 6.75 5.1 6.75-5.1" />
          <path {...strokeProps} d="M15.5 16.1h3.2M17.1 14.5v3.2" />
        </svg>
      ) : null}

    </span>
  );
}

