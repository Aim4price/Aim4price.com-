'use client';

import HomeHeroExperience, { type HomePreviewProps } from '../home-hero-experience';
import HomeAssetPreview from '../home-asset-preview';
import { homeStories, type HomeAudience } from './home-stories';

// Use the owner card shell and stroke-icon styling, with audience-specific meanings.
const recordsIcon = <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>;
const maintenanceIcon = <><path d="M14 6a5 5 0 0 0-6 6L3 17a2.8 2.8 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4 3-3Z" /></>;
const dealerIcons = {
  have: <><rect x="4" y="3" width="13" height="15" rx="2" /><path d="M8 7h5M8 11h5M8 18v3h12V6h-3" /></>,
  manage: <><path d="M3 10h18l-2-6H5l-2 6ZM5 10v10h14V10M9 20v-6h6v6" /><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /></>,
  cost: recordsIcon,
  attention: maintenanceIcon,
};
const businessIcons = {
  have: <><circle cx="6" cy="12" r="3" /><circle cx="18" cy="5" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" /></>,
  manage: <><path d="M3 7V5a2 2 0 0 1 2-2h5l3 4h6a2 2 0 0 1 2 2v10H3V7Z" /><path d="M7 12h10M7 16h6" /></>,
  cost: recordsIcon,
  attention: maintenanceIcon,
};
const dealerLabels = { worth: 'Estimate asset values', have: 'Organise stock and client assets', manage: 'Prepare assets for sale', cost: 'Review ownership reports', attention: 'Support clients after the sale' };
const businessLabels = { worth: 'Understand asset values', have: 'View client-shared assets', manage: 'Find asset details and documents', cost: 'Understand running costs', attention: 'Record maintenance and work' };
function DealerPreview(props: HomePreviewProps) {
  return <HomeAssetPreview {...props} labels={dealerLabels} icons={dealerIcons} />;
}
function BusinessPreview(props: HomePreviewProps) {
  return <HomeAssetPreview {...props} labels={businessLabels} icons={businessIcons} />;
}
export default function AudienceHome({ audience }: { audience: HomeAudience }) {
  return <HomeHeroExperience variant={homeStories[audience]} Preview={audience === 'dealers' ? DealerPreview : BusinessPreview} />;
}
