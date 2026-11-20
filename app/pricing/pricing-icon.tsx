export type PricingIconName = 'stock' | 'clients' | 'setup' | 'admin' | 'support' | 'link' | 'workspace' | 'sale' | 'savings' | 'shield' | 'services';

const paths: Record<PricingIconName, string> = {
  stock: 'M3 7 12 3l9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7.5 5l9 4',
  clients: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  setup: 'm14 6 4 4M4 20l4-1L20 7a2.83 2.83 0 0 0-4-4L4 15v5Z',
  admin: 'M8 3v4M16 3v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm3 10 3 3 5-5',
  support: 'M3 14v-3a9 9 0 0 1 18 0v3M3 12h3v7H5a2 2 0 0 1-2-2v-5Zm18 0h-3v7h1a2 2 0 0 0 2-2v-5Zm-3 7a4 4 0 0 1-4 3h-2',
  link: 'm10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0',
  workspace: 'M3 4h18v13H3V4Zm5 17h8M12 17v4M3 8h18M8 8v9',
  sale: 'M3 3h7l11 11-7 7L3 10V3Zm4 4h.01',
  savings: 'm4 7 6 6 4-4 6 6M14 15h6V9',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
  services: 'M14 6a5 5 0 0 0-6 6L3 17a2.83 2.83 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4 3-3Z',
};

export default function PricingIcon({ name }: { name: PricingIconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}
