export type MaintenanceServiceMode = 'checked' | 'serviced' | 'repaired';

export type MaintenanceServiceOption = {
  label: string;
  description: string;
};

export type MaintenanceServiceProfile = 'propelled' | 'implement';

export type MaintenanceServiceAssetLike = {
  title?: string | null;
  kind?: string | null;
  categoryLabel?: string | null;
  equipmentFamilyKey?: string | null;
  equipmentFamilyLabel?: string | null;
  usageMode?: string | null;
  usageMetric?: string | null;
  isPropelled?: boolean | null;
  canUpdateFuel?: boolean | null;
};

export type MaintenanceCompletionNoteDraft = {
  serviceMode: MaintenanceServiceMode;
  checkedItems: string[];
  servicedItems: string[];
  repairDetails: string;
  serviceCompany: string;
  mechanicName: string;
  note: string;
};

const PROPELLED_CHECKED_OPTIONS: readonly MaintenanceServiceOption[] = [
  { label: 'Oil level', description: 'Dipstick / sight glass checked.' },
  { label: 'Tyres', description: 'Pressure, tread and visible damage checked.' },
  { label: 'Safety', description: 'Guards, warning lights and obvious risks checked.' },
  { label: 'Lights', description: 'Working lights and indicators checked.' },
  { label: 'Brakes', description: 'Brake response and pedal feel checked.' },
  { label: 'Hydraulics', description: 'Hoses, rams and leaks checked.' },
  { label: 'Battery', description: 'Terminals, charge and mounting checked.' },
  { label: 'Coolant', description: 'Level and visible leaks checked.' },
  { label: 'Belts', description: 'Wear, cracks and tension checked.' },
  { label: 'Leaks', description: 'Oil, diesel, coolant and hydraulic leaks checked.' },
];

const PROPELLED_SERVICED_OPTIONS: readonly MaintenanceServiceOption[] = [
  { label: 'Changed engine oil', description: 'Engine oil drained and replaced.' },
  { label: 'Changed hydraulic oil', description: 'Hydraulic oil serviced or replaced.' },
  { label: 'Changed air filters', description: 'Air filter elements cleaned or replaced.' },
  { label: 'Changed oil filters', description: 'Engine oil filters replaced.' },
  { label: 'Changed diesel filters', description: 'Fuel / diesel filters replaced.' },
  { label: 'Greased machine', description: 'Grease points completed.' },
  { label: 'Coolant top-up', description: 'Coolant topped up or replaced.' },
  { label: 'Replaced belts', description: 'Worn belts replaced or adjusted.' },
  { label: 'Tyre repair', description: 'Tyre puncture, valve or pressure repair.' },
  { label: 'Battery service', description: 'Battery serviced, replaced or terminals cleaned.' },
];

const IMPLEMENT_CHECKED_OPTIONS: readonly MaintenanceServiceOption[] = [
  { label: 'Nuts and bolts', description: 'Loose, missing or damaged bolts checked.' },
  { label: 'Pins and bushes', description: 'Wear, play and locking clips checked.' },
  { label: 'Frame and welds', description: 'Cracks, bent sections and welds checked.' },
  { label: 'Hitch / drawbar', description: 'Hitch points, hooks and drawbar checked.' },
  { label: 'Hydraulic hoses', description: 'Hoses, couplers, rams and leaks checked.' },
  { label: 'Bearings', description: 'Noise, heat, play and visible wear checked.' },
  { label: 'Wear parts', description: 'Blades, points, discs, tines or shoes checked.' },
  { label: 'PTO / guards', description: 'PTO shaft, covers and safety guards checked.' },
  { label: 'Wheels / hubs', description: 'Wheel nuts, hubs, bearings and tyres checked.' },
  { label: 'Grease points', description: 'Grease nipples and moving joints checked.' },
  { label: 'Safety decals', description: 'Warnings, reflectors and visible markings checked.' },
];

const IMPLEMENT_SERVICED_OPTIONS: readonly MaintenanceServiceOption[] = [
  { label: 'Tightened bolts', description: 'Loose fasteners tightened or replaced.' },
  { label: 'Replaced pins / bushes', description: 'Worn pins, bushes or clips replaced.' },
  { label: 'Repaired frame / welds', description: 'Cracks, bends or welds repaired.' },
  { label: 'Replaced wear parts', description: 'Blades, points, discs, tines or shoes replaced.' },
  { label: 'Serviced hydraulics', description: 'Hydraulic hoses, couplers or cylinders repaired.' },
  { label: 'Replaced bearings', description: 'Bearings, seals or hubs replaced.' },
  { label: 'Greased implement', description: 'Grease points and moving joints serviced.' },
  { label: 'Serviced PTO / guards', description: 'PTO shaft, covers or guards repaired.' },
  { label: 'Adjusted setup', description: 'Depth, angle, calibration or working setup adjusted.' },
  { label: 'Wheel / hub service', description: 'Wheel nuts, tyres, hubs or axles serviced.' },
  { label: 'Cleaned implement', description: 'Mud, crop material or residue removed.' },
];

const IMPLEMENT_HINTS = [
  'implement', 'implements', 'tool', 'tools', 'attachment', 'attachments', 'trailer', 'trailers',
  'header', 'headers', 'plough', 'plow', 'ripper', 'cultivator', 'harrow', 'disc', 'disk', 'planter',
  'seeder', 'seed drill', 'fertilizer spreader', 'spreader', 'baler', 'mower', 'slasher', 'mulcher',
  'roller', 'auger', 'fork', 'blade',
] as const;

const PROPELLED_HINTS = [
  'vehicle', 'bakkie', 'truck', 'tractor', 'combine', 'harvester', 'self propelled',
  'self-propelled', 'loader', 'telehandler', 'forklift', 'excavator', 'dozer', 'bulldozer',
  'grader', 'skid steer', 'tlb',
] as const;

function classifierText(asset: MaintenanceServiceAssetLike): string {
  return [
    asset.kind,
    asset.categoryLabel,
    asset.equipmentFamilyKey,
    asset.equipmentFamilyLabel,
    asset.title,
  ]
    .join(' ')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAnyHint(text: string, hints: readonly string[]): boolean {
  return hints.some((hint) => text.includes(hint));
}

export function resolveAssetServiceProfile(
  asset: MaintenanceServiceAssetLike | null,
): MaintenanceServiceProfile {
  if (!asset) return 'propelled';
  if (
    asset.isPropelled
    || asset.canUpdateFuel
    || asset.kind === 'vehicle'
    || asset.kind === 'tractor'
  ) return 'propelled';

  const text = classifierText(asset);
  if (containsAnyHint(text, IMPLEMENT_HINTS)) return 'implement';
  if (asset.usageMode === 'percent' || asset.usageMetric === 'percentage') return 'implement';
  if (
    containsAnyHint(text, PROPELLED_HINTS)
    || asset.usageMode === 'km'
    || asset.usageMode === 'hours'
    || asset.usageMetric === 'km'
    || asset.usageMetric === 'hours'
  ) return 'propelled';
  return 'implement';
}

export function checkedOptionsForProfile(
  profile: MaintenanceServiceProfile,
): readonly MaintenanceServiceOption[] {
  return profile === 'implement' ? IMPLEMENT_CHECKED_OPTIONS : PROPELLED_CHECKED_OPTIONS;
}

export function servicedOptionsForProfile(
  profile: MaintenanceServiceProfile,
): readonly MaintenanceServiceOption[] {
  return profile === 'implement' ? IMPLEMENT_SERVICED_OPTIONS : PROPELLED_SERVICED_OPTIONS;
}

export function serviceCopyForProfile(profile: MaintenanceServiceProfile) {
  const implement = profile === 'implement';
  return {
    checkedDescription: 'Inspection.',
    servicedDescription: 'Service job.',
    repairedDescription: 'Repair job.',
    checkedTitle: 'Check',
    servicedTitle: 'Service',
    repairedTitle: 'Repair',
    checkedPrompt: 'Select inspected items.',
    servicedPrompt: 'Select work done.',
    repairedPrompt: 'Fault · fix · parts.',
    checkedHeader: 'Checked items',
    checkedSubheader: 'Select every item inspected.',
    servicedHeader: 'Service work',
    servicedSubheader: 'Select work completed.',
    repairedHeader: 'Repair note',
    repairedSubheader: 'Capture the fault, fix and parts replaced.',
    detailsHeader: 'Who did the work?',
    detailsSubheader: implement ? 'Company and technician.' : 'Company and mechanic.',
    companyLabel: implement ? 'Company / Workshop' : 'Company / Dealer',
    companyPlaceholder: implement ? 'Company or workshop name' : 'Company or dealer name',
    mechanicLabel: implement ? 'Technician name' : 'Mechanic name',
    mechanicPlaceholder: implement ? 'Technician name' : 'Mechanic name',
    checkedNotePlaceholder: implement
      ? 'Example: bolts checked, pins checked, no visible cracks.'
      : 'Example: oil checked, tyres checked, no visible leaks.',
    servicedNotePlaceholder: implement
      ? 'Example: replaced points, tightened bolts and greased pins.'
      : 'Example: full service completed; oil and filters replaced.',
    repairedNotePlaceholder: implement
      ? 'Example: cracked bracket repaired; two bushes replaced; welds checked.'
      : 'Example: hydraulic leak repaired; hose replaced; pressure tested.',
    repairedExtraNotePlaceholder: 'Optional: parts used or follow-up needed.',
  };
}

export function buildMaintenanceCompletionNote(draft: MaintenanceCompletionNoteDraft): string {
  const note = draft.note.trim();
  if (draft.serviceMode === 'checked') {
    return [
      'Checked',
      draft.checkedItems.length ? `Checked items: ${draft.checkedItems.join(', ')}` : '',
      note ? `Notes/Problems: ${note}` : '',
    ].filter(Boolean).join('\n');
  }
  if (draft.serviceMode === 'serviced') {
    return [
      'Serviced',
      draft.servicedItems.length ? `Work done: ${draft.servicedItems.join(', ')}` : '',
      draft.serviceCompany.trim() ? `Company: ${draft.serviceCompany.trim()}` : '',
      draft.mechanicName.trim() ? `Mechanic: ${draft.mechanicName.trim()}` : '',
      note ? `Notes/Problems: ${note}` : '',
    ].filter(Boolean).join('\n');
  }
  return [
    'Repaired',
    draft.repairDetails.trim() ? `Repair details: ${draft.repairDetails.trim()}` : '',
    draft.serviceCompany.trim() ? `Company: ${draft.serviceCompany.trim()}` : '',
    draft.mechanicName.trim() ? `Mechanic: ${draft.mechanicName.trim()}` : '',
    note ? `Notes/Problems: ${note}` : '',
  ].filter(Boolean).join('\n');
}
