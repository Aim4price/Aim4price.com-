import Link from "next/link";
import styles from "./DiscoveryMarketplaceSwitch.module.css";

type Props = {
  active: "discovery" | "marketplace";
  dealerAppMode?: boolean;
};

export default function DiscoveryMarketplaceSwitch({
  active,
  dealerAppMode = false,
}: Props) {
  const discoveryHref = dealerAppMode
    ? "/dealer/discovery"
    : "/asset-discovery";
  const marketplaceHref = dealerAppMode
    ? "/dealer/marketplace"
    : "/marketplace";

  return (
    <nav
      className={`${styles.switch} ${dealerAppMode ? styles.compact : ""}`}
      aria-label="Discovery and Marketplace"
    >
      <Link
        href={discoveryHref}
        className={active === "discovery" ? styles.active : ""}
        aria-current={active === "discovery" ? "page" : undefined}
      >
        Discover Assets
      </Link>
      <Link
        href={marketplaceHref}
        className={active === "marketplace" ? styles.active : ""}
        aria-current={active === "marketplace" ? "page" : undefined}
      >
        Marketplace
      </Link>
    </nav>
  );
}
