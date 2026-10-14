import type { HomeStoryVariant } from '../home-hero-experience';

export type HomeAudience = 'dealers' | 'businesses';
export const homeStories: Record<HomeAudience, HomeStoryVariant> = {
  dealers: {
    label: 'dealers',
    promise: ['Know your clients’ assets.', 'Know their value.', 'Help clients buy and sell.'],
    description: 'Bring stock, client assets and estimated values together. Make every buying and selling conversation better informed.',
    features: {
      worth: {
        title: 'Know what it’s worth.',
        body: 'Get an indicative estimate for a vehicle, machine or piece of equipment before discussing a sale or trade-in.',
        detail: 'Review its age, usage and condition to give the price context.',
      },
      have: {
        title: 'Keep every asset organised.',
        titleLines: ['Keep every asset', 'organised.'],
        body: 'Manage your stock and client registers with asset details, photos and values together.',
        detail: 'Keep dealer-held stock distinct from the assets owners share with you.',
      },
      manage: {
        title: 'Prepare assets for sale.',
        titleLines: ['Prepare assets', 'for sale.'],
        body: 'Keep photos, details and supporting records ready for the next buyer.',
        detail: 'Use your showroom and Ad Studio to present your stock professionally.',
      },
      cost: {
        title: 'Look beyond the price.',
        body: 'Review the fuel, maintenance and ownership reports a client shares with you.',
        detail: 'Understand the asset’s running costs before discussing their next move.',
      },
      attention: {
        title: 'Stay useful after the sale.',
        titleLines: ['Stay useful', 'after the sale.'],
        body: 'Help clients keep maintenance, reported problems and completed work together.',
        detail: 'With their permission, contribute to a useful history of the asset.',
      },
    },
  },
  businesses: {
    label: 'businesses',
    promise: ['Know your clients’ assets.', 'Understand their needs.', 'Deliver better service.'],
    description: 'Work with the assets and records your clients share. Find the context you need to offer a better service.',
    features: {
      worth: {
        title: 'Start with a clearer value.',
        titleLines: ['Start with', 'a clearer value.'],
        body: 'See the asset’s details and indicative estimated value before discussing your client’s needs.',
        detail: 'Use that context alongside your own professional assessment.',
      },
      have: {
        title: 'See what clients share.',
        body: 'View the vehicles, machinery and equipment your clients share with your business.',
        detail: 'Keep their asset details, photos and values easy to find.',
      },
      manage: {
        title: 'Find the details you need.',
        titleLines: ['Find the details', 'you need.'],
        body: 'Review shared documents, asset information and history in one place.',
        detail: 'The owner chooses which records and tools your business can access.',
      },
      cost: {
        title: 'Understand the running costs.',
        titleLines: ['Understand', 'the running costs.'],
        body: 'Use shared fuel, maintenance and ownership reports to understand how the asset is used and maintained.',
        detail: 'Bring useful context into your next service or advice conversation.',
      },
      attention: {
        title: 'Keep your work with the asset.',
        titleLines: ['Keep your work', 'with the asset.'],
        body: 'Record maintenance, follow reported problems and keep completed work connected to the right asset.',
        detail: 'Contribute with the owner’s permission, ready for the next visit.',
      },
    },
  },
};
