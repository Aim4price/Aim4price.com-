import type { HomeStoryVariant } from '../home-hero-experience';

export type HomeAudience = 'dealers' | 'businesses';
export const homeStories: Record<HomeAudience, HomeStoryVariant> = {
  "dealers": {
    "label": "dealers",
    "promise": [
      "Know your clients’ assets.",
      "Understand their value.",
      "Bring confidence to every deal."
    ],
    "description": "Bring asset values, stock and client records together—so every purchase, trade-in and sale starts with a clearer picture.",
    "features": {
      "worth": {
        "title": "Put every price into perspective.",
        "titleLines": [
          "Put every price",
          "into perspective."
        ],
        "body": "Start with an indicative estimate, then consider the asset’s age, usage and condition.",
        "detail": "Give buying, selling and trade-in discussions a more informed starting point."
      },
      "have": {
        "title": "Keep stock and client assets organised.",
        "titleLines": [
          "Keep stock and client",
          "assets organised."
        ],
        "body": "Bring details, photos and values together in clear asset registers.",
        "detail": "Keep your stock distinct from client assets, with the right information ready when they call."
      },
      "manage": {
        "title": "Give buyers a clearer picture.",
        "titleLines": [
          "Give buyers",
          "a clearer picture."
        ],
        "body": "Keep photos and records ready for buyers.",
        "detail": "Present stock with your showroom and Ad Studio."
      },
      "cost": {
        "title": "Understand what the price doesn’t show.",
        "titleLines": [
          "Understand what",
          "the price doesn’t show."
        ],
        "body": "Review shared fuel, maintenance and ownership reports to understand the costs behind an asset.",
        "detail": "Bring more context into discussions about keeping, replacing or selling it."
      },
      "attention": {
        "title": "Build relationships beyond the sale.",
        "titleLines": [
          "Build relationships",
          "beyond the sale."
        ],
        "body": "Keep supporting clients through maintenance updates, reported problems and completed work.",
        "detail": "With their permission, help build an asset history that remains useful long after the handover."
      }
    }
  },
  "businesses": {
    "label": "businesses",
    "promise": [
      "Know your clients’ assets.",
      "Understand their needs.",
      "Bring insight to every service."
    ],
    "description": "Connect the assets your clients share with the service you provide. Use their details, documents and history to understand the need before deciding what comes next.",
    "features": {
      "worth": {
        "title": "Understand the asset behind the request.",
        "titleLines": [
          "Understand the asset",
          "behind the request."
        ],
        "body": "Start with the asset’s details, usage and indicative estimated value.",
        "detail": "Bring useful context into your assessment before discussing the service your client needs."
      },
      "have": {
        "title": "See your clients’ assets more clearly.",
        "titleLines": [
          "See your clients’",
          "assets more clearly."
        ],
        "body": "View the individual assets or groups your clients share with your business.",
        "detail": "Keep the available details, photos and values together for an easier, more informed conversation."
      },
      "manage": {
        "title": "Find the information your work depends on.",
        "titleLines": [
          "Find the information",
          "your work depends on."
        ],
        "body": "Review shared documents, details and history.",
        "detail": "Use the records and tools your client allows."
      },
      "cost": {
        "title": "Turn asset records into practical insight.",
        "titleLines": [
          "Turn asset records",
          "into practical insight."
        ],
        "body": "Review shared fuel, maintenance and ownership reports to understand running costs and recorded work.",
        "detail": "Use that context to ask better questions and support your recommendations."
      },
      "attention": {
        "title": "Make your work part of the history.",
        "titleLines": [
          "Make your work",
          "part of the history."
        ],
        "body": "With the owner’s permission, record maintenance, updates and completed work against the right asset.",
        "detail": "Leave a useful record for your client and the next service visit."
      }
    }
  }
};
