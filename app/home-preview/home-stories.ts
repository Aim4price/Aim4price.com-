import type { HomeStoryVariant } from '../home-hero-experience';

export type HomeAudience = 'dealers' | 'businesses';
export const homeStories: Record<HomeAudience, HomeStoryVariant> = {
  dealers: {
    label: 'dealers',
    promise: ['Know their assets.', 'Know their value.', 'Help clients trade.'],
    description: 'Value assets. Manage stock. Support clients.',
    features: {
      worth: { title: 'Know the value.', body: 'Start buying and selling conversations with an indicative estimate.', detail: '' },
      have: { title: 'Stay organised.', body: 'Keep stock and client assets organised separately.', detail: '' },
      manage: { title: 'See the details.', body: 'Review the details and history your client shares.', detail: '' },
      cost: { title: 'Know the costs.', body: 'Review shared fuel, maintenance and ownership reports.', detail: '' },
      attention: { title: 'Stay connected.', body: 'Support clients after the sale, with their permission.', detail: '' },
    },
  },
  businesses: {
    label: 'businesses',
    promise: ['Know their assets.', 'Understand their needs.', 'Serve clients better.'],
    description: 'Shared assets. Clearer insight. Better service.',
    features: {
      worth: { title: 'Understand value.', body: 'Use indicative estimates to inform your assessment.', detail: '' },
      have: { title: 'See their assets.', body: 'View the assets your clients choose to share.', detail: '' },
      manage: { title: 'Find the details.', body: 'Access shared details, documents and history together.', detail: '' },
      cost: { title: 'Gain insight.', body: 'Understand costs through the reports clients share.', detail: '' },
      attention: { title: 'Record your work.', body: 'Add maintenance and updates with the owner’s permission.', detail: '' },
    },
  },
};
