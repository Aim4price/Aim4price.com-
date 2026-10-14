import type { HomeStoryVariant } from '../home-hero-experience';

export type HomeAudience = 'dealers' | 'businesses';
export const homeStories: Record<HomeAudience, HomeStoryVariant> = {
  dealers: {
    label: 'dealers',
    promise: ['Know your clients’ assets.', 'Know what they’re worth.', 'Help clients buy and sell.'],
    description: 'Estimate values. Organise stock. Support your clients.',
    features: {
      worth: { title: 'Know its value.', body: 'Get an indicative estimate before buying, selling or discussing a trade-in.', detail: 'Review condition and usage before agreeing a price.' },
      have: { title: 'Keep assets organised.', body: 'Keep your stock and client asset records easy to find.', detail: 'Your stock stays separate from owner-shared assets.' },
      manage: { title: 'See the full picture.', body: 'Review asset details, photos and shared history before the next conversation.', detail: 'Available tools depend on the owner’s permissions.' },
      cost: { title: 'Understand the costs.', body: 'Review shared fuel, maintenance and ownership reports.', detail: 'See the spending behind the asset.' },
      attention: { title: 'Support clients beyond the sale.', titleLines: ['Support clients', 'beyond the sale.'], body: 'Help keep maintenance and asset history up to date.', detail: 'Contribute where the owner gives you access.' },
    },
  },
  businesses: {
    label: 'businesses',
    promise: ['Know your clients’ assets.', 'Understand their needs.', 'Deliver a better service.'],
    description: 'Understand the asset. Find the details. Help your client.',
    features: {
      worth: { title: 'Start with its value.', body: 'Use asset details and indicative estimates to understand your client’s needs.', detail: 'Your professional assessment still applies.' },
      have: { title: 'See what clients own.', body: 'View the assets and details your clients share with you.', detail: 'Owners choose what you can access.' },
      manage: { title: 'Find what you need.', body: 'Keep shared details, documents and asset history together.', detail: 'Less searching. More context for your work.' },
      cost: { title: 'Turn records into insight.', titleLines: ['Turn records', 'into insight.'], body: 'Review the reports your client has shared.', detail: 'Understand costs and maintenance before advising.' },
      attention: { title: 'Keep your work connected.', titleLines: ['Keep your work', 'connected.'], body: 'Record maintenance and updates against the right asset.', detail: 'Owner-approved contributions build a useful history.' },
    },
  },
};
