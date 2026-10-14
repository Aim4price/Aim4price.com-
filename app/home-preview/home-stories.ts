import type { HomeStoryVariant } from '../home-hero-experience';

export type HomeAudience = 'dealers' | 'businesses';
export const homeStories: Record<HomeAudience, HomeStoryVariant> = {
  dealers: {
    label: 'dealers',
    promise: ['Know your clients’ assets.', 'Know what they’re worth.', 'Help clients buy and sell.'],
    description: 'Bring your stock and client relationships together. Understand asset values, keep records organised and give every buying or selling conversation a clearer starting point.',
    features: {
      worth: { title: 'What is this asset worth?', body: 'Start with an indicative estimate for a vehicle, machine or piece of equipment. Review its details, usage and condition to put the figure into context.', detail: 'Use the estimate to support a conversation about a purchase, trade-in or sale. It is a starting point for your judgement, not a guaranteed selling price.' },
      have: { title: 'Keep stock and client assets organised.', body: 'Keep the stock you hold distinct from the assets your clients share with you. Bring the relevant details together so you can find the right record when a client calls.', detail: 'Use registers to organise your own stock. Review owner-shared assets through the access each client gives you, without taking ownership of their records.' },
      manage: { title: 'Understand the asset before making an offer.', body: 'Look beyond a price. Review the details, photos, documents and history that the owner has chosen to share with you.', detail: 'Build a clearer picture before a discussion or inspection. Available information depends on the owner’s record and sharing permissions.' },
      cost: { title: 'Present your stock professionally.', body: 'Give prospective buyers a clear view of what you have available. Use your showroom to present stock and Ad Studio to prepare advertising material.', detail: 'Bring the asset’s photos and key details into the presentation. Review the information before sharing it with potential buyers.' },
      attention: { title: 'Stay useful after the sale.', body: 'Keep supporting clients as their assets work. Where access is granted, help record maintenance, costs and supporting information against the relevant asset.', detail: 'Build a more useful asset history over time. The owner stays in control of what you can see and which contributions you can make.' },
    },
  },
  businesses: {
    label: 'businesses',
    promise: ['Know your clients’ assets.', 'Understand their needs.', 'Deliver a better service.'],
    description: 'Start with the assets behind your clients’ needs. Bring shared details, estimates and supporting records into a clearer conversation about the service you provide.',
    features: {
      worth: { title: 'Start with a clearer picture of the asset.', body: 'Understand what the client has, how it is used and its indicative estimated value. Start the service conversation with useful context.', detail: 'Estimates help inform a discussion. Your own assessment, inspection and professional requirements still apply.' },
      have: { title: 'Let clients show you what they own.', body: 'Let owners share an individual asset or a group of assets with your business. Find the information they have made available in one connected record.', detail: 'The owner chooses what to share. Your business works with that shared information while ownership and access remain with the client.' },
      manage: { title: 'Find the information your work needs.', body: 'Review the photos, documents, asset details and history the client has shared. Use the available information to understand the request before following up.', detail: 'Workshops, insurers and other service providers need different information. Only the records and reports covered by the owner’s permissions are available.' },
      cost: { title: 'Keep your contribution with the asset.', body: 'Where the owner gives permission, add the work, supporting documents or updates that belong with the asset you are helping with.', detail: 'Keep useful information connected to the right record so the client has context for future maintenance, reviews and service conversations.' },
      attention: { title: 'Build an ongoing working relationship.', body: 'Return to the shared asset record as your client’s needs develop. Use its available history to make the next conversation easier to follow.', detail: 'Access remains permission-based. Clients decide what stays shared and can change access as their relationship with your business changes.' },
    },
  },
};
