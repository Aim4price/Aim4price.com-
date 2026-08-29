import styles from './MarketplaceWhatsAppAction.module.css';

type MarketplaceWhatsAppActionProps = {
  href: string;
  sellerName?: string;
};

export default function MarketplaceWhatsAppAction({ href, sellerName }: MarketplaceWhatsAppActionProps) {
  const contactName = sellerName?.trim() || 'seller';

  return (
    <a
      className={styles.action}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      aria-label={`WhatsApp ${contactName} (opens in a new tab)`}
    >
      <span className={styles.iconSurface} aria-hidden="true">
        <svg className={styles.icon} viewBox="0 0 24 24">
          <path d="M12 3.25a8.55 8.55 0 0 0-7.26 13.05l-1.06 3.9 4.04-1.02A8.55 8.55 0 1 0 12 3.25Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.55 7.65c.22-.48.45-.5.68-.5h.6c.2 0 .43.05.57.38l.78 1.82c.1.27.08.5-.08.72l-.42.53c-.1.12-.13.28-.05.43.48.9 1.35 1.78 2.34 2.34.15.08.3.05.43-.05l.53-.42c.22-.17.45-.2.72-.08l1.82.78c.33.13.38.37.38.57v.6c0 .23-.02.47-.5.68-.5.22-1.14.34-1.9.24-2.28-.32-5.83-3.86-6.15-6.15-.1-.76.02-1.4.25-1.9Z" fill="currentColor" />
        </svg>
      </span>
      <span className={styles.copy}>
        <strong>WhatsApp seller</strong>
        <small>Open a private chat about this advert</small>
      </span>
      <span className={styles.arrow} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M5 12h13M13 7l5 5-5 5" />
        </svg>
      </span>
    </a>
  );
}
