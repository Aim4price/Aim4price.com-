// lib/tractor-data.ts
// Styling-first prototype data file.
// This is local dummy data intended to keep the valuation UI populated while you design.

export type TractorType = 'field' | 'orchard';
export type DriveType = '2wd' | '4wd';
export type CabType = 'cab' | 'open-station';
export type ConditionKey = 'excellent' | 'good' | 'fair' | 'used' | 'serious';

export type BrandRow = {
  name: string;
  slug: string;
};

export type ConditionOption = {
  key: ConditionKey;
  label: string;
  factor: number;
  multiplier: number;
  adjustment: number;
};

export type TractorCatalogRow = {
  id: string;
  title: string;
  name: string;
  brandName: string;
  brandSlug: string;
  modelName: string;
  tractorType: TractorType;
  drive: DriveType;
  cab: CabType;
  powerKw: number;
  powerHp: number;
  horsepowerHp: number;
  yearStart: number;
  yearEnd: number;
  startYear: number;
  endYear: number;
  aim4priceReplacementExVat: number;
  replacementPriceExVat: number;
  departmentReplacementExVat: number;
  imageSrc: string;
};

export type DepartmentBand = {
  id: string;
  label: string;
  minPowerKw: number;
  maxPowerKw: number;
  minKw: number;
  maxKw: number;
  powerKw: number;
  drive: DriveType;
  replacementPriceExVat: number;
  replacementExVat: number;
  hourlyDepreciationExVat: number;
  hourlyDepreciation: number;
  depreciationPerHourExVat: number;
  salvageFloorPercent: number;
  salvageFloorPct: number;
  minimumValuePercent: number;
};

export type MarketplaceListing = {
  id: string;
  modelId: string;
  title: string;
  brandName: string;
  brandSlug: string;
  modelName: string;
  tractorType: TractorType;
  drive: DriveType;
  cab: CabType;
  yearModel: number;
  year: number;
  hours: number;
  province: string;
  area: string;
  location: string;
  sourceName: string;
  dateAdvertised: string;
  advertisedPriceExVat: number;
  priceExVat: number;
  askingPriceExVat: number;
  price: number;
  imageSrc: string;
};

const DEFAULT_IMAGE = '/brand/Tractor.png';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const brandNames = [
  'Zoomlion',
  'YTO',
  'Yanmar',
  'VST',
  'Versatile',
  'Van Breda',
  'Valtra',
  'Ursus',
  'Tafe',
  'Sonalika',
  'Same',
  'Renault',
  'New Holland',
  'Minneapolis-Moline',
  'Mercedes',
  'Massey Ferguson',
  'McCormick',
  'Mahindra',
  'Lovol',
  'Leyland',
  'Landini',
  'Lamborghini',
  'Kubota',
  'John Deere',
  'Kirovets',
  'Jinma',
  'JCB',
  'J.I. Case',
  'International Harvester',
  'Hinomoto',
  'Foton',
  'Fordson Major',
  'Ford',
  'Ford New Holland',
  'Fiat',
  'Fendt',
  'Deutz-Fahr',
  'Farmtrac',
  'Deutz',
  'David Brown',
  'County',
  'Claas',
  'Challenger',
  'Case IH',
  'Buhler Versatile',
  'Belarus',
  'Allis Chalmers',
  'ACO',
  'Agrico',
  'Antonio Carraro',
];

export const brands: BrandRow[] = brandNames.map((name) => ({
  name,
  slug: slugify(name),
}));

export const conditionOptions: ConditionOption[] = [
  { key: 'excellent', label: 'Excellent', factor: 1.08, multiplier: 1.08, adjustment: 1.08 },
  { key: 'good', label: 'Good', factor: 1, multiplier: 1, adjustment: 1 },
  { key: 'fair', label: 'Fair', factor: 0.93, multiplier: 0.93, adjustment: 0.93 },
  { key: 'used', label: 'Used', factor: 0.86, multiplier: 0.86, adjustment: 0.86 },
  { key: 'serious', label: 'Serious Wear', factor: 0.76, multiplier: 0.76, adjustment: 0.76 },
];

function tractor(input: {
  id: string;
  brandName: string;
  modelName: string;
  tractorType: TractorType;
  drive: DriveType;
  cab: CabType;
  powerKw: number;
  yearStart: number;
  yearEnd: number;
  replacementPriceExVat: number;
}): TractorCatalogRow {
  const powerHp = Math.round(input.powerKw * 1.341);

  return {
    id: input.id,
    title: `${input.brandName} ${input.modelName}`,
    name: `${input.brandName} ${input.modelName}`,
    brandName: input.brandName,
    brandSlug: slugify(input.brandName),
    modelName: input.modelName,
    tractorType: input.tractorType,
    drive: input.drive,
    cab: input.cab,
    powerKw: input.powerKw,
    powerHp,
    horsepowerHp: powerHp,
    yearStart: input.yearStart,
    yearEnd: input.yearEnd,
    startYear: input.yearStart,
    endYear: input.yearEnd,
    aim4priceReplacementExVat: input.replacementPriceExVat,
    replacementPriceExVat: input.replacementPriceExVat,
    departmentReplacementExVat: input.replacementPriceExVat,
    imageSrc: DEFAULT_IMAGE,
  };
}

export const tractors: TractorCatalogRow[] = [
  tractor({
    id: 'john-deere-6135b-field-4wd-cab',
    brandName: 'John Deere',
    modelName: '6135B',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 99,
    yearStart: 2018,
    yearEnd: 2023,
    replacementPriceExVat: 1185000,
  }),
  tractor({
    id: 'john-deere-6m-120-field-4wd-cab',
    brandName: 'John Deere',
    modelName: '6M 120',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 88,
    yearStart: 2018,
    yearEnd: 2024,
    replacementPriceExVat: 1095000,
  }),
  tractor({
    id: 'john-deere-6r-130-field-4wd-cab',
    brandName: 'John Deere',
    modelName: '6R 130',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 96,
    yearStart: 2019,
    yearEnd: 2024,
    replacementPriceExVat: 1280000,
  }),
  tractor({
    id: 'john-deere-5100e-field-2wd-open-station',
    brandName: 'John Deere',
    modelName: '5100E',
    tractorType: 'field',
    drive: '2wd',
    cab: 'open-station',
    powerKw: 75,
    yearStart: 2016,
    yearEnd: 2023,
    replacementPriceExVat: 760000,
  }),
  tractor({
    id: 'john-deere-5075gn-orchard-4wd-open-station',
    brandName: 'John Deere',
    modelName: '5075GN',
    tractorType: 'orchard',
    drive: '4wd',
    cab: 'open-station',
    powerKw: 55,
    yearStart: 2017,
    yearEnd: 2023,
    replacementPriceExVat: 690000,
  }),
  tractor({
    id: 'new-holland-td5-110-field-4wd-cab',
    brandName: 'New Holland',
    modelName: 'TD5.110',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 82,
    yearStart: 2018,
    yearEnd: 2024,
    replacementPriceExVat: 1015000,
  }),
  tractor({
    id: 'new-holland-ts6-120-field-4wd-cab',
    brandName: 'New Holland',
    modelName: 'TS6.120',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 92,
    yearStart: 2018,
    yearEnd: 2024,
    replacementPriceExVat: 1110000,
  }),
  tractor({
    id: 'new-holland-t4f-90-orchard-4wd-cab',
    brandName: 'New Holland',
    modelName: 'T4F 90',
    tractorType: 'orchard',
    drive: '4wd',
    cab: 'cab',
    powerKw: 66,
    yearStart: 2017,
    yearEnd: 2024,
    replacementPriceExVat: 820000,
  }),
  tractor({
    id: 'massey-ferguson-6713-field-4wd-cab',
    brandName: 'Massey Ferguson',
    modelName: '6713',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 97,
    yearStart: 2018,
    yearEnd: 2024,
    replacementPriceExVat: 1165000,
  }),
  tractor({
    id: 'case-ih-jxu-110-field-4wd-cab',
    brandName: 'Case IH',
    modelName: 'JXU 110',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 82,
    yearStart: 2017,
    yearEnd: 2022,
    replacementPriceExVat: 995000,
  }),
  tractor({
    id: 'kubota-m110gx-field-4wd-cab',
    brandName: 'Kubota',
    modelName: 'M110GX',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 81,
    yearStart: 2017,
    yearEnd: 2022,
    replacementPriceExVat: 960000,
  }),
  tractor({
    id: 'fendt-314-vario-field-4wd-cab',
    brandName: 'Fendt',
    modelName: '314 Vario',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 104,
    yearStart: 2018,
    yearEnd: 2024,
    replacementPriceExVat: 1450000,
  }),
  tractor({
    id: 'deutz-fahr-5105g-field-4wd-cab',
    brandName: 'Deutz-Fahr',
    modelName: '5105G',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 77,
    yearStart: 2018,
    yearEnd: 2024,
    replacementPriceExVat: 920000,
  }),
  tractor({
    id: 'valtra-a114-field-4wd-cab',
    brandName: 'Valtra',
    modelName: 'A114',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 82,
    yearStart: 2018,
    yearEnd: 2024,
    replacementPriceExVat: 1040000,
  }),
  tractor({
    id: 'same-argon-110-field-4wd-cab',
    brandName: 'Same',
    modelName: 'Argon 110',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 81,
    yearStart: 2018,
    yearEnd: 2023,
    replacementPriceExVat: 940000,
  }),
  tractor({
    id: 'same-frutteto-90-orchard-4wd-cab',
    brandName: 'Same',
    modelName: 'Frutteto 90',
    tractorType: 'orchard',
    drive: '4wd',
    cab: 'cab',
    powerKw: 66,
    yearStart: 2018,
    yearEnd: 2024,
    replacementPriceExVat: 835000,
  }),
  tractor({
    id: 'landini-rex-100-orchard-4wd-cab',
    brandName: 'Landini',
    modelName: 'REX 100',
    tractorType: 'orchard',
    drive: '4wd',
    cab: 'cab',
    powerKw: 73,
    yearStart: 2018,
    yearEnd: 2024,
    replacementPriceExVat: 880000,
  }),
  tractor({
    id: 'claas-elios-240-field-4wd-cab',
    brandName: 'Claas',
    modelName: 'Elios 240',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 76,
    yearStart: 2018,
    yearEnd: 2024,
    replacementPriceExVat: 935000,
  }),
];

function departmentBand(input: {
  id: string;
  minPowerKw: number;
  maxPowerKw: number;
  drive: DriveType;
  replacementPriceExVat: number;
  hourlyDepreciationExVat: number;
  salvageFloorPercent: number;
}): DepartmentBand {
  const midpointKw = Math.round((input.minPowerKw + input.maxPowerKw) / 2);

  return {
    id: input.id,
    label: `${input.minPowerKw}-${input.maxPowerKw} kW ${input.drive.toUpperCase()}`,
    minPowerKw: input.minPowerKw,
    maxPowerKw: input.maxPowerKw,
    minKw: input.minPowerKw,
    maxKw: input.maxPowerKw,
    powerKw: midpointKw,
    drive: input.drive,
    replacementPriceExVat: input.replacementPriceExVat,
    replacementExVat: input.replacementPriceExVat,
    hourlyDepreciationExVat: input.hourlyDepreciationExVat,
    hourlyDepreciation: input.hourlyDepreciationExVat,
    depreciationPerHourExVat: input.hourlyDepreciationExVat,
    salvageFloorPercent: input.salvageFloorPercent,
    salvageFloorPct: input.salvageFloorPercent,
    minimumValuePercent: input.salvageFloorPercent,
  };
}

export const departmentBands: DepartmentBand[] = [
  departmentBand({
    id: '2wd-60-79',
    minPowerKw: 60,
    maxPowerKw: 79,
    drive: '2wd',
    replacementPriceExVat: 760000,
    hourlyDepreciationExVat: 18,
    salvageFloorPercent: 0.36,
  }),
  departmentBand({
    id: '2wd-80-99',
    minPowerKw: 80,
    maxPowerKw: 99,
    drive: '2wd',
    replacementPriceExVat: 910000,
    hourlyDepreciationExVat: 21,
    salvageFloorPercent: 0.35,
  }),
  departmentBand({
    id: '4wd-50-69',
    minPowerKw: 50,
    maxPowerKw: 69,
    drive: '4wd',
    replacementPriceExVat: 780000,
    hourlyDepreciationExVat: 20,
    salvageFloorPercent: 0.37,
  }),
  departmentBand({
    id: '4wd-70-89',
    minPowerKw: 70,
    maxPowerKw: 89,
    drive: '4wd',
    replacementPriceExVat: 980000,
    hourlyDepreciationExVat: 26,
    salvageFloorPercent: 0.35,
  }),
  departmentBand({
    id: '4wd-90-109',
    minPowerKw: 90,
    maxPowerKw: 109,
    drive: '4wd',
    replacementPriceExVat: 1180000,
    hourlyDepreciationExVat: 32,
    salvageFloorPercent: 0.34,
  }),
  departmentBand({
    id: '4wd-110-129',
    minPowerKw: 110,
    maxPowerKw: 129,
    drive: '4wd',
    replacementPriceExVat: 1360000,
    hourlyDepreciationExVat: 38,
    salvageFloorPercent: 0.33,
  }),
];

function listing(input: {
  id: string;
  modelId: string;
  brandName: string;
  modelName: string;
  tractorType: TractorType;
  drive: DriveType;
  cab: CabType;
  yearModel: number;
  hours: number;
  province: string;
  area: string;
  sourceName: string;
  dateAdvertised: string;
  advertisedPriceExVat: number;
}): MarketplaceListing {
  return {
    id: input.id,
    modelId: input.modelId,
    title: `${input.brandName} ${input.modelName}`,
    brandName: input.brandName,
    brandSlug: slugify(input.brandName),
    modelName: input.modelName,
    tractorType: input.tractorType,
    drive: input.drive,
    cab: input.cab,
    yearModel: input.yearModel,
    year: input.yearModel,
    hours: input.hours,
    province: input.province,
    area: input.area,
    location: `${input.area}, ${input.province}`,
    sourceName: input.sourceName,
    dateAdvertised: input.dateAdvertised,
    advertisedPriceExVat: input.advertisedPriceExVat,
    priceExVat: input.advertisedPriceExVat,
    askingPriceExVat: input.advertisedPriceExVat,
    price: input.advertisedPriceExVat,
    imageSrc: DEFAULT_IMAGE,
  };
}

export const listings: MarketplaceListing[] = [
  listing({
    id: 'jd-6135b-001',
    modelId: 'john-deere-6135b-field-4wd-cab',
    brandName: 'John Deere',
    modelName: '6135B',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    yearModel: 2019,
    hours: 4200,
    province: 'Free State',
    area: 'Bloemfontein',
    sourceName: 'AutoTrader',
    dateAdvertised: '2026-02-03',
    advertisedPriceExVat: 790000,
  }),
  listing({
    id: 'jd-6135b-002',
    modelId: 'john-deere-6135b-field-4wd-cab',
    brandName: 'John Deere',
    modelName: '6135B',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    yearModel: 2020,
    hours: 3600,
    province: 'Mpumalanga',
    area: 'Middelburg',
    sourceName: 'Dealer Network',
    dateAdvertised: '2026-02-06',
    advertisedPriceExVat: 845000,
  }),
  listing({
    id: 'jd-6135b-003',
    modelId: 'john-deere-6135b-field-4wd-cab',
    brandName: 'John Deere',
    modelName: '6135B',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    yearModel: 2020,
    hours: 3400,
    province: 'Western Cape',
    area: 'Malmesbury',
    sourceName: 'Dealer Network',
    dateAdvertised: '2026-02-08',
    advertisedPriceExVat: 855000,
  }),
  listing({
    id: 'jd-6135b-004',
    modelId: 'john-deere-6135b-field-4wd-cab',
    brandName: 'John Deere',
    modelName: '6135B',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    yearModel: 2021,
    hours: 3100,
    province: 'KwaZulu-Natal',
    area: 'Pietermaritzburg',
    sourceName: 'AutoTrader',
    dateAdvertised: '2026-02-12',
    advertisedPriceExVat: 910000,
  }),
  listing({
    id: 'jd-6135b-005',
    modelId: 'john-deere-6135b-field-4wd-cab',
    brandName: 'John Deere',
    modelName: '6135B',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    yearModel: 2018,
    hours: 4700,
    province: 'North West',
    area: 'Lichtenburg',
    sourceName: 'Dealer Network',
    dateAdvertised: '2026-02-14',
    advertisedPriceExVat: 780000,
  }),
  listing({
    id: 'jd-6135b-006',
    modelId: 'john-deere-6135b-field-4wd-cab',
    brandName: 'John Deere',
    modelName: '6135B',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    yearModel: 2020,
    hours: 3900,
    province: 'Gauteng',
    area: 'Pretoria',
    sourceName: 'Dealer Network',
    dateAdvertised: '2026-02-18',
    advertisedPriceExVat: 830000,
  }),
  listing({
    id: 'jd-6m120-001',
    modelId: 'john-deere-6m-120-field-4wd-cab',
    brandName: 'John Deere',
    modelName: '6M 120',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    yearModel: 2019,
    hours: 4300,
    province: 'Free State',
    area: 'Bethlehem',
    sourceName: 'Dealer Network',
    dateAdvertised: '2026-02-03',
    advertisedPriceExVat: 810000,
  }),
  listing({
    id: 'jd-6m120-002',
    modelId: 'john-deere-6m-120-field-4wd-cab',
    brandName: 'John Deere',
    modelName: '6M 120',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    yearModel: 2020,
    hours: 3500,
    province: 'Western Cape',
    area: 'Paarl',
    sourceName: 'AutoTrader',
    dateAdvertised: '2026-02-09',
    advertisedPriceExVat: 845000,
  }),
  listing({
    id: 'jd-6m120-003',
    modelId: 'john-deere-6m-120-field-4wd-cab',
    brandName: 'John Deere',
    modelName: '6M 120',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    yearModel: 2021,
    hours: 2900,
    province: 'Mpumalanga',
    area: 'Ermelo',
    sourceName: 'Dealer Network',
    dateAdvertised: '2026-02-11',
    advertisedPriceExVat: 895000,
  }),
  listing({
    id: 'jd-6m120-004',
    modelId: 'john-deere-6m-120-field-4wd-cab',
    brandName: 'John Deere',
    modelName: '6M 120',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    yearModel: 2020,
    hours: 3800,
    province: 'Limpopo',
    area: 'Polokwane',
    sourceName: 'Dealer Network',
    dateAdvertised: '2026-02-15',
    advertisedPriceExVat: 860000,
  }),
  listing({
    id: 'nh-td5-001',
    modelId: 'new-holland-td5-110-field-4wd-cab',
    brandName: 'New Holland',
    modelName: 'TD5.110',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    yearModel: 2020,
    hours: 3400,
    province: 'Eastern Cape',
    area: 'Cradock',
    sourceName: 'Dealer Network',
    dateAdvertised: '2026-02-04',
    advertisedPriceExVat: 765000,
  }),
  listing({
    id: 'nh-td5-002',
    modelId: 'new-holland-td5-110-field-4wd-cab',
    brandName: 'New Holland',
    modelName: 'TD5.110',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    yearModel: 2021,
    hours: 2600,
    province: 'KwaZulu-Natal',
    area: 'Howick',
    sourceName: 'AutoTrader',
    dateAdvertised: '2026-02-13',
    advertisedPriceExVat: 825000,
  }),
  listing({
    id: 'mf-6713-001',
    modelId: 'massey-ferguson-6713-field-4wd-cab',
    brandName: 'Massey Ferguson',
    modelName: '6713',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    yearModel: 2020,
    hours: 3700,
    province: 'Free State',
    area: 'Kroonstad',
    sourceName: 'Dealer Network',
    dateAdvertised: '2026-02-05',
    advertisedPriceExVat: 805000,
  }),
  listing({
    id: 'case-jxu-001',
    modelId: 'case-ih-jxu-110-field-4wd-cab',
    brandName: 'Case IH',
    modelName: 'JXU 110',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    yearModel: 2019,
    hours: 4100,
    province: 'North West',
    area: 'Potchefstroom',
    sourceName: 'AutoTrader',
    dateAdvertised: '2026-02-07',
    advertisedPriceExVat: 760000,
  }),
  listing({
    id: 'kubota-001',
    modelId: 'kubota-m110gx-field-4wd-cab',
    brandName: 'Kubota',
    modelName: 'M110GX',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    yearModel: 2020,
    hours: 3000,
    province: 'Western Cape',
    area: 'George',
    sourceName: 'Dealer Network',
    dateAdvertised: '2026-02-16',
    advertisedPriceExVat: 790000,
  }),
];

export const equipmentTypes = [
  {
    key: 'tractor',
    label: 'Tractor',
    imageSrc: DEFAULT_IMAGE,
    active: true,
  },
  {
    key: 'combine',
    label: 'Combine',
    imageSrc: DEFAULT_IMAGE,
    active: false,
  },
  {
    key: 'baler',
    label: 'Baler',
    imageSrc: DEFAULT_IMAGE,
    active: false,
  },
  {
    key: 'sprayer',
    label: 'Sprayer',
    imageSrc: DEFAULT_IMAGE,
    active: false,
  },
];
