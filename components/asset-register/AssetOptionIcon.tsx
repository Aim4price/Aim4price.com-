const paths = {
  machine: 'M3 8h4l2-3h6v3h4v3h2v6h-3l-2 2H8l-3-3H3zM2 10v4M9 3h5',
  car: 'M3 11l2-6h13l3 6v7h-3m-12 0H3v-7h18M6 14h2m8 0h2M6 18v2m12-2v2',
  boat: 'M3 13l9-3 9 3-4 6H7zM7 12V6h10v6M12 6V3',
  home: 'M2 11l10-8 10 8M5 10v11h14V10M10 21v-7h4v7',
  wrench: 'M14 6a5 5 0 0 0-6 6l-5 5a2 2 0 0 0 4 4l6-6a5 5 0 0 0 6-7l-3 3-3-3 3-3z',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
  screen: 'M3 4h18v13H3zM8 21h8m-4-4v4',
  more: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM17.5 14v7M14 17.5h7',
  receipt: 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM8 7h8m-8 4h8m-8 4h4',
  replace: 'M3 10a9 9 0 0 1 15-5l3 3M21 3v5h-5M21 14a9 9 0 0 1-15 5l-3-3m0 5v-5h5',
  tag: 'M3 3h8l10 10-8 8L3 11zM7 7h.1',
  market: 'M3 3v17h18M6 15l5-6 4 3 6-7',
  place: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0zM14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  briefcase: 'M3 8h18v12H3zM8 8V4h8v4M3 12l9 3 9-3',
  plant: 'M12 21V11M12 16C5 16 3 11 3 7c6 0 9 2 9 9zM12 12c0-6 4-9 9-9 0 5-3 9-9 9z',
  key: 'M14 4a5 5 0 1 1-3 9l-7 7H2v-4l7-7a5 5 0 0 1 5-5zM16 8h.1',
  livestock: 'M7 7 4 4 2 6l4 4m11-3 3-3 2 2-4 4M7 7h10l1 8-3 4H9l-3-4zM9 11h.1m5.8 0h.1M10 16h4',
  battery: 'M4 6h15v12H4zM19 10h2v4h-2M12 8l-3 5h5l-3 4',
  chair: 'M6 12V5h12v7M4 11v5h16v-5M6 16v5m12-5v5M6 12h12',
  phone: 'M7 2h10v20H7zM11 18h2',
  cold: 'M12 2v20M3 7l18 10M3 17L21 7M9 4l3 3 3-3M9 20l3-3 3 3',
  yes: 'm4 12 5 5L20 6',
  no: 'm5 5 14 14M19 5 5 19',
  question: 'M8 8a4 4 0 1 1 7 3c-2 2-3 2-3 5m0 3h.01',
} as const;

const groups: Record<string, keyof typeof paths> = {
  equipment: 'machine', vehicle: 'car', property: 'home', tools: 'wrench', stock: 'box', manual: 'screen',
  furniture_contents: 'chair', appliances: 'machine', computers_it: 'screen', portable_electronics: 'phone',
  commercial_refrigeration: 'cold', kitchen_catering: 'machine', security_systems: 'key', power_energy: 'battery',
  fixtures_improvements: 'wrench', high_value_items: 'tag', land: 'plant', building_structure: 'home',
  fixed_improvement: 'wrench', tenant_improvement: 'wrench', raw_materials: 'box', finished_goods: 'box',
  parts_spares: 'wrench', agricultural_inputs: 'plant', produce: 'plant', livestock: 'livestock', third_party_stock: 'box',
  purchase_cost: 'receipt', replacement_cost: 'replace', selling_price: 'tag', market_value: 'market',
  business: 'briefcase', mixed: 'briefcase', premises: 'place', portable: 'briefcase', moves_between_locations: 'car',
  fixed: 'home', owned_occupied: 'home', owned_let: 'key', leased_occupied: 'key', one_location: 'place',
  multiple_locations: 'place', regular_transit: 'car', seasonal_locations: 'replace', unknown: 'question',
  included: 'receipt', excluded: 'receipt',
};

export default function AssetOptionIcon({ value, className }: { value: string; className?: string }) {
  const key = groups[value] || (value in paths ? value as keyof typeof paths : 'more');
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[key]} /></svg>;
}
