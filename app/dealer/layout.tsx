import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import DealerNav from "./dealer-nav";
import DealerSessionKeeper from "./dealer-session-keeper";
import styles from "./dealer.module.css";

export const metadata: Metadata = {
  applicationName: "Aim4price Dealer App",
  title: "Aim4price Dealer",
  description:
    "Simple Dealer App access to leads, maintenance, discovery, estimates, costs and Marketplace.",
  manifest: "/dealer/manifest.webmanifest?v=6",
  icons: {
    icon: [
      {
        url: "/dealer-icon-192-dark.png?v=1",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/dealer-icon-512-dark.png?v=1",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/dealer-apple-touch-icon-dark.png?v=1",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Dealer",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#103f34",
};

export default function DealerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DealerSessionKeeper />
      <div className={styles.dealerLayout}>
        <DealerNav />
        <div className={styles.patternPageContent}>{children}</div>
      </div>
    </>
  );
}
