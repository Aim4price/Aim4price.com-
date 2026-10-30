import { redirect } from 'next/navigation';
import AdvertCreator from './AdvertCreator';
import { getMarketplaceManualAccess } from '../lib/marketplace-manual-access';
import { normalizeAdBrandSnapshot } from '../lib/ad-studio';
import { listAdBrandKits } from '../lib/ad-studio-db';
import { isMiddlemanAccountSubtype } from '../lib/middleman-account';
import styles from './AdStudioClient.module.css';

export default async function MarketplaceManualPage({ realm = '' }: { realm?: '' | '/dealer' | '/middleman' | '/owner-app' }) {
  const access = await getMarketplaceManualAccess();
  if (!access) redirect(realm ? `${realm}/login` : '/auth');
  const { profile, userId } = access;
  const dealer = profile.accountType === 'dealer';
  const kits = dealer ? await listAdBrandKits(userId) : [];
  const fallbackBrand = normalizeAdBrandSnapshot({
    templateId: 'photo-first', logoUrl: profile.logoUrl, businessName: profile.businessName,
    contactName: profile.marketplaceSellerName || profile.displayName || profile.name,
    phone: profile.marketplacePhone || profile.phone, email: profile.marketplaceEmail || profile.email,
    website: profile.websiteUrl,
  })!;
  return <div className={styles.page}>
    <div className={styles.titlePanel}><h1>CREATE LISTING</h1></div>
    <AdvertCreator kits={kits} fallbackBrand={fallbackBrand} initialManual
      includeShowroom={dealer} publishEndpoint="/api/marketplace/manual"
      marketplaceHref={realm ? `${realm}/marketplace` : '/marketplace/browse'}
      middlemanMode={isMiddlemanAccountSubtype(profile.accountSubtype)}
      assetRegisterHref={realm === '/owner-app' ? '/owner-app/assets' : realm ? '/dealer/inventory' : '/asset-register'}
      estimateHref={`${realm}/valuation?marketplace=1`} estimatesEndpoint="/api/ad-studio/estimates" />
  </div>;
}
