'use client';

import HomeHeroExperience, { type HomePreviewProps } from '../home-hero-experience';
import HomeAssetPreview from '../home-asset-preview';
import { homeStories, type HomeAudience } from './home-stories';

const dealerLabels = { worth: 'Estimate values', have: 'Organise assets', manage: 'Manage client assets', cost: 'Review costs', attention: 'Support clients' };
const businessLabels = { worth: 'Understand value', have: 'View shared assets', manage: 'Find asset information', cost: 'Review reports', attention: 'Record your work' };
function DealerPreview(props: HomePreviewProps) {
  return <HomeAssetPreview {...props} labels={dealerLabels} />;
}
function BusinessPreview(props: HomePreviewProps) {
  return <HomeAssetPreview {...props} labels={businessLabels} />;
}
export default function AudienceHome({ audience }: { audience: HomeAudience }) {
  return <HomeHeroExperience variant={homeStories[audience]} Preview={audience === 'dealers' ? DealerPreview : BusinessPreview} />;
}
