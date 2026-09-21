'use client';
import { useEffect, useState } from 'react';
import { googleDirectoryEnabled, loadGoogleDirectory } from './GoogleDirectoryMap';
import styles from './BusinessProfileCard.module.css';
export type DirectoryBusiness = {
    userId: string;
    businessName: string;
    displayName: string;
    isExternalBusiness?: boolean;
    logoUrl: string;
    extraPhotoUrls: string[];
    description: string;
    services: string;
    addressLine1: string;
    townCity: string;
    province: string;
    email: string;
    phone: string;
    websiteUrl: string;
    googleMapsUrl?: string;
    googlePlaceId?: string;
};
function safeWebsite(value: string) { try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
}
catch {
    return '';
} }
export default function BusinessProfileCard({ business, onClose, onMessage, onAdd, selected }: {
    business: DirectoryBusiness;
    onClose: () => void;
    onMessage: () => void;
    onAdd?: () => void;
    selected?: boolean;
}) {
    const [google, setGoogle] = useState<any>(null);
    useEffect(() => {
        let active = true;
        setGoogle(null);
        if (googleDirectoryEnabled && business.googlePlaceId)
            void loadGoogleDirectory().then(async (maps) => {
                const { Place } = await maps.importLibrary('places');
                const place = new Place({ id: business.googlePlaceId });
                await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'nationalPhoneNumber', 'websiteURI', 'googleMapsURI', 'photos', 'primaryTypeDisplayName'] });
                if (active)
                    setGoogle(place);
            }).catch(() => { });
        return () => { active = false; };
    }, [business.googlePlaceId, business.userId]);
    const phone = business.phone || google?.nationalPhoneNumber || '';
    const name = google?.displayName || business.businessName || business.displayName;
    const photo = google?.photos?.[0];
    const photoUrl = photo?.getURI({ maxWidth: 600, maxHeight: 300 }) || business.extraPhotoUrls?.[0] || business.logoUrl;
    const website = safeWebsite(google?.websiteURI || business.websiteUrl || '');
    const mapsUrl = safeWebsite(google?.googleMapsURI || business.googleMapsUrl || '');
    return <aside className={styles.card} aria-label="Selected business">
    <div className={styles.heading}><span className={styles.badge}>{business.isExternalBusiness ? 'Directory listing' : 'Aim4price account'}</span><button type="button" onClick={onClose} aria-label="Close business profile">×</button></div>
    {photoUrl ? <img className={styles.photo} src={photoUrl} alt={name}/> : business.logoUrl ? <img className={styles.logo} src={business.logoUrl} alt=""/> : null}
    {photo?.authorAttributions?.map((a: any, i: number) => <a key={i} className={styles.attribution} href={safeWebsite(a.uri || '')} target="_blank" rel="noreferrer">{a.displayName}</a>)}
    <h4>{name}</h4><p>{google?.primaryTypeDisplayName || business.description || business.services}</p>
    <div className={styles.actions}>{website ? <a href={website} target="_blank" rel="noreferrer">Website</a> : null}{mapsUrl ? <a href={mapsUrl} target="_blank" rel="noreferrer">View on Google Maps</a> : null}</div>
    <dl><dt>Address</dt><dd>{google?.formattedAddress || [business.addressLine1, business.townCity, business.province].filter(Boolean).join(', ') || 'Not provided'}</dd>
    {business.services ? <><dt>Services</dt><dd>{business.services}</dd></> : null}
    {phone ? <><dt>Phone</dt><dd><a href={`tel:${phone.replace(/[^+\d]/g, '')}`}>{phone}</a></dd></> : null}
    {business.email ? <><dt>Email</dt><dd><a href={`mailto:${encodeURIComponent(business.email)}`}>{business.email}</a></dd></> : null}</dl>
    {google ? <small className={styles.attribution} translate="no">Business profile information from Google Maps</small> : null}
    <button type="button" className={styles.primary} onClick={onMessage}>Send message</button>
    {onAdd ? <button type="button" onClick={onAdd}>{selected ? 'Remove from recipients' : 'Add to recipients'}</button> : null}
    <small>{business.isExternalBusiness ? 'Share photos and reports by WhatsApp or email.' : 'Send an Aim4price lead with your selected permissions.'}</small>
  </aside>;
}
