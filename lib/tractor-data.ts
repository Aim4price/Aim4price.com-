// lib/tractor-data.ts
// Styling-first prototype data file.
// This is local dummy data intended to keep the valuation UI populated while you design.

export type TractorType = 'field' | 'orchard';
export type DriveType = '2wd' | '4wd' | 'tracks';
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

export type DepartmentAgBand = {
  id: string;
  label: string;
  tractorType: TractorType;
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

export type DepartmentBand = DepartmentAgBand;

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
  powerKw: number;
  powerHp: number;
  horsepowerHp: number;
  yearModel: number;
  year: number;
  hours: number;
  province: string;
  area: string;
  location: string;
  sourceName: string;
  sourceUrl?: string;
  dateAdvertised: string;
  advertisedPriceExVat: number;
  priceExVat: number;
  askingPriceExVat: number;
  price: number;
  imageSrc: string;
};

export type EquipmentTypeOption = {
  key: 'tractor' | 'combine' | 'baler' | 'sprayer';
  label: string;
  imageSrc: string;
  active: boolean;
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
    yearEnd: 2024,
    replacementPriceExVat: 845000,
  }),
  tractor({
    id: 'new-holland-td5-110-field-4wd-cab',
    brandName: 'New Holland',
    modelName: 'TD5.110',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 82,
    yearStart: 2017,
    yearEnd: 2024,
    replacementPriceExVat: 985000,
  }),
  tractor({
    id: 'new-holland-ts6-125-field-4wd-cab',
    brandName: 'New Holland',
    modelName: 'TS6.125',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 93,
    yearStart: 2018,
    yearEnd: 2024,
    replacementPriceExVat: 1175000,
  }),
  tractor({
    id: 'massey-ferguson-5713s-field-4wd-cab',
    brandName: 'Massey Ferguson',
    modelName: '5713S',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 97,
    yearStart: 2018,
    yearEnd: 2024,
    replacementPriceExVat: 1215000,
  }),
  tractor({
    id: 'massey-ferguson-6713-field-4wd-cab',
    brandName: 'Massey Ferguson',
    modelName: '6713',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 97,
    yearStart: 2017,
    yearEnd: 2023,
    replacementPriceExVat: 1160000,
  }),
  tractor({
    id: 'deutz-fahr-5125g-field-4wd-cab',
    brandName: 'Deutz-Fahr',
    modelName: '5125G',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 92,
    yearStart: 2018,
    yearEnd: 2024,
    replacementPriceExVat: 1195000,
  }),
  tractor({
    id: 'fendt-312-vario-field-4wd-cab',
    brandName: 'Fendt',
    modelName: '312 Vario',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 86,
    yearStart: 2017,
    yearEnd: 2024,
    replacementPriceExVat: 1385000,
  }),
  tractor({
    id: 'case-ih-jxu-110-field-4wd-cab',
    brandName: 'Case IH',
    modelName: 'JXU 110',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 82,
    yearStart: 2015,
    yearEnd: 2022,
    replacementPriceExVat: 980000,
  }),
  tractor({
    id: 'case-ih-farmall-110a-field-4wd-cab',
    brandName: 'Case IH',
    modelName: 'Farmall 110A',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 82,
    yearStart: 2017,
    yearEnd: 2024,
    replacementPriceExVat: 1025000,
  }),
  tractor({
    id: 'kubota-m9540-field-4wd-cab',
    brandName: 'Kubota',
    modelName: 'M9540',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 70,
    yearStart: 2014,
    yearEnd: 2022,
    replacementPriceExVat: 875000,
  }),
  tractor({
    id: 'kubota-m108s-field-4wd-cab',
    brandName: 'Kubota',
    modelName: 'M108S',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 80,
    yearStart: 2015,
    yearEnd: 2023,
    replacementPriceExVat: 965000,
  }),
  tractor({
    id: 'same-explorer-110-field-4wd-cab',
    brandName: 'Same',
    modelName: 'Explorer 110',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 81,
    yearStart: 2016,
    yearEnd: 2023,
    replacementPriceExVat: 955000,
  }),
  tractor({
    id: 'landini-powerfarm-110-field-4wd-cab',
    brandName: 'Landini',
    modelName: 'Powerfarm 110',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 81,
    yearStart: 2016,
    yearEnd: 2024,
    replacementPriceExVat: 935000,
  }),
  tractor({
    id: 'mahindra-9500-field-4wd-cab',
    brandName: 'Mahindra',
    modelName: '9500',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 74,
    yearStart: 2015,
    yearEnd: 2023,
    replacementPriceExVat: 785000,
  }),
  tractor({
    id: 'valtra-a104-field-4wd-cab',
    brandName: 'Valtra',
    modelName: 'A104',
    tractorType: 'field',
    drive: '4wd',
    cab: 'cab',
    powerKw: 74,
    yearStart: 2017,
    yearEnd: 2024,
    replacementPriceExVat: 1095000,
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
    replacementPriceExVat: 995000,
  }),
  tractor({
    id: 'john-deere-5090gf-orchard-4wd-cab',
    brandName: 'John Deere',
    modelName: '5090GF',
    tractorType: 'orchard',
    drive: '4wd',
    cab: 'cab',
    powerKw: 66,
    yearStart: 2018,
    yearEnd: 2024,
    replacementPriceExVat: 945000,
  }),
  tractor({
    id: 'new-holland-t4-110v-orchard-4wd-cab',
    brandName: 'New Holland',
    modelName: 'T4.110V',
    tractorType: 'orchard',
    drive: '4wd',
    cab: 'cab',
    powerKw: 79,
    yearStart: 2018,
    yearEnd: 2024,
    replacementPriceExVat: 1085000,
  }),
  tractor({
    id: 'same-frutteto-90-orchard-4wd-cab',
    brandName: 'Same',
    modelName: 'Frutteto 90',
    tractorType: 'orchard',
    drive: '4wd',
    cab: 'cab',
    powerKw: 66,
    yearStart: 2017,
    yearEnd: 2024,
    replacementPriceExVat: 905000,
  }),
];

function departmentBand(input: {
  id: string;
  label: string;
  tractorType: TractorType;
  minKw: number;
  maxKw: number;
  drive: DriveType;
  replacementExVat: number;
  depreciationPerHourExVat: number;
  salvageFloorPct: number;
}): DepartmentAgBand {
  return {
    id: input.id,
    label: input.label,
    tractorType: input.tractorType,
    minPowerKw: input.minKw,
    maxPowerKw: input.maxKw,
    minKw: input.minKw,
    maxKw: input.maxKw,
    powerKw: Math.round((input.minKw + input.maxKw) / 2),
    drive: input.drive,
    replacementPriceExVat: input.replacementExVat,
    replacementExVat: input.replacementExVat,
    hourlyDepreciationExVat: input.depreciationPerHourExVat,
    hourlyDepreciation: input.depreciationPerHourExVat,
    depreciationPerHourExVat: input.depreciationPerHourExVat,
    salvageFloorPercent: input.salvageFloorPct,
    salvageFloorPct: input.salvageFloorPct,
    minimumValuePercent: input.salvageFloorPct,
  };
}

export const departmentBands: DepartmentBand[] = [
  departmentBand({
    id: 'field-61-80-2wd',
    label: 'Field tractors 61-80 kW • 2WD',
    tractorType: 'field',
    minKw: 61,
    maxKw: 80,
    drive: '2wd',
    replacementExVat: 820000,
    depreciationPerHourExVat: 52,
    salvageFloorPct: 0.3,
  }),
  departmentBand({
    id: 'field-61-80-4wd',
    label: 'Field tractors 61-80 kW • 4WD',
    tractorType: 'field',
    minKw: 61,
    maxKw: 80,
    drive: '4wd',
    replacementExVat: 945000,
    depreciationPerHourExVat: 58,
    salvageFloorPct: 0.31,
  }),
  departmentBand({
    id: 'field-81-100-2wd',
    label: 'Field tractors 81-100 kW • 2WD',
    tractorType: 'field',
    minKw: 81,
    maxKw: 100,
    drive: '2wd',
    replacementExVat: 965000,
    depreciationPerHourExVat: 64,
    salvageFloorPct: 0.31,
  }),
  departmentBand({
    id: 'field-81-100-4wd',
    label: 'Field tractors 81-100 kW • 4WD',
    tractorType: 'field',
    minKw: 81,
    maxKw: 100,
    drive: '4wd',
    replacementExVat: 1095000,
    depreciationPerHourExVat: 72,
    salvageFloorPct: 0.32,
  }),
  departmentBand({
    id: 'field-101-120-4wd',
    label: 'Field tractors 101-120 kW • 4WD',
    tractorType: 'field',
    minKw: 101,
    maxKw: 120,
    drive: '4wd',
    replacementExVat: 1285000,
    depreciationPerHourExVat: 84,
    salvageFloorPct: 0.33,
  }),
  departmentBand({
    id: 'orchard-61-80-4wd',
    label: 'Orchard tractors 61-80 kW • 4WD',
    tractorType: 'orchard',
    minKw: 61,
    maxKw: 80,
    drive: '4wd',
    replacementExVat: 995000,
    depreciationPerHourExVat: 61,
    salvageFloorPct: 0.32,
  }),
  departmentBand({
    id: 'orchard-81-100-4wd',
    label: 'Orchard tractors 81-100 kW • 4WD',
    tractorType: 'orchard',
    minKw: 81,
    maxKw: 100,
    drive: '4wd',
    replacementExVat: 1135000,
    depreciationPerHourExVat: 72,
    salvageFloorPct: 0.33,
  }),
];

type ListingInput = {
  id: string;
  modelId: string;
  yearModel: number;
  hours: number;
  province: string;
  area: string;
  sourceName: string;
  sourceUrl: string;
  dateAdvertised: string;
  askingPriceExVat: number;
};

function listing(input: ListingInput): MarketplaceListing {
  const model = tractors.find((row) => row.id === input.modelId);

  if (!model) {
    throw new Error(`Missing tractor model for listing: ${input.modelId}`);
  }

  return {
    id: input.id,
    modelId: model.id,
    title: `${model.brandName} ${model.modelName}`,
    brandName: model.brandName,
    brandSlug: model.brandSlug,
    modelName: model.modelName,
    tractorType: model.tractorType,
    drive: model.drive,
    cab: model.cab,
    powerKw: model.powerKw,
    powerHp: model.powerHp,
    horsepowerHp: model.horsepowerHp,
    yearModel: input.yearModel,
    year: input.yearModel,
    hours: input.hours,
    province: input.province,
    area: input.area,
    location: `${input.area}, ${input.province}`,
    sourceName: input.sourceName,
    sourceUrl: input.sourceUrl,
    dateAdvertised: input.dateAdvertised,
    advertisedPriceExVat: input.askingPriceExVat,
    priceExVat: input.askingPriceExVat,
    askingPriceExVat: input.askingPriceExVat,
    price: input.askingPriceExVat,
    imageSrc: model.imageSrc,
  };
}

export const listings: MarketplaceListing[] = [
  listing({
    id: 'seed-jd-6m120-01',
    modelId: 'john-deere-6m-120-field-4wd-cab',
    yearModel: 2019,
    hours: 3200,
    province: 'KwaZulu-Natal',
    area: 'Pietermaritzburg',
    sourceName: 'AutoTrader',
    sourceUrl: 'https://www.autotrader.co.za',
    dateAdvertised: '2026-03-11',
    askingPriceExVat: 780000,
  }),
  listing({
    id: 'seed-jd-6m120-02',
    modelId: 'john-deere-6m-120-field-4wd-cab',
    yearModel: 2020,
    hours: 3600,
    province: 'Mpumalanga',
    area: 'Middelburg',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agrimag.co.za',
    dateAdvertised: '2026-03-14',
    askingPriceExVat: 845000,
  }),
  listing({
    id: 'seed-jd-6m120-03',
    modelId: 'john-deere-6m-120-field-4wd-cab',
    yearModel: 2020,
    hours: 3400,
    province: 'Western Cape',
    area: 'Malmesbury',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agtrader.co.za',
    dateAdvertised: '2026-03-18',
    askingPriceExVat: 855000,
  }),
  listing({
    id: 'seed-jd-6m120-04',
    modelId: 'john-deere-6m-120-field-4wd-cab',
    yearModel: 2021,
    hours: 2900,
    province: 'KwaZulu-Natal',
    area: 'Pietermaritzburg',
    sourceName: 'AutoTrader',
    sourceUrl: 'https://www.autotrader.co.za',
    dateAdvertised: '2026-03-21',
    askingPriceExVat: 910000,
  }),
  listing({
    id: 'seed-jd-6m120-05',
    modelId: 'john-deere-6m-120-field-4wd-cab',
    yearModel: 2019,
    hours: 4700,
    province: 'North West',
    area: 'Lichtenburg',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agrisales.co.za',
    dateAdvertised: '2026-03-04',
    askingPriceExVat: 790000,
  }),
  listing({
    id: 'seed-jd-6m120-06',
    modelId: 'john-deere-6m-120-field-4wd-cab',
    yearModel: 2020,
    hours: 3900,
    province: 'Free State',
    area: 'Bloemfontein',
    sourceName: 'AutoTrader',
    sourceUrl: 'https://www.autotrader.co.za',
    dateAdvertised: '2026-03-25',
    askingPriceExVat: 830000,
  }),
  listing({
    id: 'seed-jd-6135b-01',
    modelId: 'john-deere-6135b-field-4wd-cab',
    yearModel: 2021,
    hours: 3800,
    province: 'KwaZulu-Natal',
    area: 'Greytown',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agtrader.co.za',
    dateAdvertised: '2026-03-10',
    askingPriceExVat: 910000,
  }),
  listing({
    id: 'seed-jd-6135b-02',
    modelId: 'john-deere-6135b-field-4wd-cab',
    yearModel: 2022,
    hours: 2500,
    province: 'Mpumalanga',
    area: 'Standerton',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agrimag.co.za',
    dateAdvertised: '2026-03-16',
    askingPriceExVat: 980000,
  }),
  listing({
    id: 'seed-jd-6135b-03',
    modelId: 'john-deere-6135b-field-4wd-cab',
    yearModel: 2023,
    hours: 1200,
    province: 'Free State',
    area: 'Bethlehem',
    sourceName: 'AutoTrader',
    sourceUrl: 'https://www.autotrader.co.za',
    dateAdvertised: '2026-03-24',
    askingPriceExVat: 1085000,
  }),
  listing({
    id: 'seed-jd-6r130-01',
    modelId: 'john-deere-6r-130-field-4wd-cab',
    yearModel: 2021,
    hours: 2400,
    province: 'Western Cape',
    area: 'Riversdale',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agtrader.co.za',
    dateAdvertised: '2026-03-09',
    askingPriceExVat: 1125000,
  }),
  listing({
    id: 'seed-jd-6r130-02',
    modelId: 'john-deere-6r-130-field-4wd-cab',
    yearModel: 2022,
    hours: 1800,
    province: 'KwaZulu-Natal',
    area: 'Howick',
    sourceName: 'AutoTrader',
    sourceUrl: 'https://www.autotrader.co.za',
    dateAdvertised: '2026-03-20',
    askingPriceExVat: 1195000,
  }),
  listing({
    id: 'seed-jd-5100e-01',
    modelId: 'john-deere-5100e-field-2wd-open-station',
    yearModel: 2018,
    hours: 5200,
    province: 'Limpopo',
    area: 'Tzaneen',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agrisales.co.za',
    dateAdvertised: '2026-03-06',
    askingPriceExVat: 585000,
  }),
  listing({
    id: 'seed-jd-5100e-02',
    modelId: 'john-deere-5100e-field-2wd-open-station',
    yearModel: 2020,
    hours: 3100,
    province: 'North West',
    area: 'Klerksdorp',
    sourceName: 'AutoTrader',
    sourceUrl: 'https://www.autotrader.co.za',
    dateAdvertised: '2026-03-19',
    askingPriceExVat: 670000,
  }),
  listing({
    id: 'seed-nh-td5110-01',
    modelId: 'new-holland-td5-110-field-4wd-cab',
    yearModel: 2019,
    hours: 4100,
    province: 'Free State',
    area: 'Bothaville',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agrimag.co.za',
    dateAdvertised: '2026-03-08',
    askingPriceExVat: 760000,
  }),
  listing({
    id: 'seed-nh-td5110-02',
    modelId: 'new-holland-td5-110-field-4wd-cab',
    yearModel: 2021,
    hours: 2300,
    province: 'KwaZulu-Natal',
    area: 'Richards Bay',
    sourceName: 'AutoTrader',
    sourceUrl: 'https://www.autotrader.co.za',
    dateAdvertised: '2026-03-17',
    askingPriceExVat: 845000,
  }),
  listing({
    id: 'seed-nh-ts6125-01',
    modelId: 'new-holland-ts6-125-field-4wd-cab',
    yearModel: 2020,
    hours: 3200,
    province: 'Mpumalanga',
    area: 'Ermelo',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agtrader.co.za',
    dateAdvertised: '2026-03-12',
    askingPriceExVat: 920000,
  }),
  listing({
    id: 'seed-mf-5713s-01',
    modelId: 'massey-ferguson-5713s-field-4wd-cab',
    yearModel: 2019,
    hours: 4300,
    province: 'Western Cape',
    area: 'George',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agrisales.co.za',
    dateAdvertised: '2026-03-07',
    askingPriceExVat: 870000,
  }),
  listing({
    id: 'seed-mf-5713s-02',
    modelId: 'massey-ferguson-5713s-field-4wd-cab',
    yearModel: 2021,
    hours: 2600,
    province: 'KwaZulu-Natal',
    area: 'Ixopo',
    sourceName: 'AutoTrader',
    sourceUrl: 'https://www.autotrader.co.za',
    dateAdvertised: '2026-03-22',
    askingPriceExVat: 960000,
  }),
  listing({
    id: 'seed-mf-6713-01',
    modelId: 'massey-ferguson-6713-field-4wd-cab',
    yearModel: 2020,
    hours: 3500,
    province: 'Free State',
    area: 'Kroonstad',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agrimag.co.za',
    dateAdvertised: '2026-03-13',
    askingPriceExVat: 905000,
  }),
  listing({
    id: 'seed-df-5125g-01',
    modelId: 'deutz-fahr-5125g-field-4wd-cab',
    yearModel: 2020,
    hours: 3100,
    province: 'Mpumalanga',
    area: 'Bethal',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agrisales.co.za',
    dateAdvertised: '2026-03-11',
    askingPriceExVat: 940000,
  }),
  listing({
    id: 'seed-fendt-312-01',
    modelId: 'fendt-312-vario-field-4wd-cab',
    yearModel: 2021,
    hours: 1800,
    province: 'Western Cape',
    area: 'Paarl',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agtrader.co.za',
    dateAdvertised: '2026-03-15',
    askingPriceExVat: 1215000,
  }),
  listing({
    id: 'seed-case-jxu110-01',
    modelId: 'case-ih-jxu-110-field-4wd-cab',
    yearModel: 2019,
    hours: 4100,
    province: 'North West',
    area: 'Lichtenburg',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agrimag.co.za',
    dateAdvertised: '2026-03-09',
    askingPriceExVat: 760000,
  }),
  listing({
    id: 'seed-case-jxu110-02',
    modelId: 'case-ih-jxu-110-field-4wd-cab',
    yearModel: 2020,
    hours: 3600,
    province: 'Mpumalanga',
    area: 'Middelburg',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agrimag.co.za',
    dateAdvertised: '2026-03-13',
    askingPriceExVat: 780000,
  }),
  listing({
    id: 'seed-case-jxu110-03',
    modelId: 'case-ih-jxu-110-field-4wd-cab',
    yearModel: 2020,
    hours: 2900,
    province: 'Free State',
    area: 'Bloemfontein',
    sourceName: 'AutoTrader',
    sourceUrl: 'https://www.autotrader.co.za',
    dateAdvertised: '2026-03-19',
    askingPriceExVat: 790000,
  }),
  listing({
    id: 'seed-case-jxu110-04',
    modelId: 'case-ih-jxu-110-field-4wd-cab',
    yearModel: 2021,
    hours: 2100,
    province: 'Gauteng',
    area: 'Bronkhorstspruit',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agtrader.co.za',
    dateAdvertised: '2026-03-23',
    askingPriceExVat: 830000,
  }),
  listing({
    id: 'seed-case-jxu110-05',
    modelId: 'case-ih-jxu-110-field-4wd-cab',
    yearModel: 2021,
    hours: 2400,
    province: 'Mpumalanga',
    area: 'Middelburg',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agrisales.co.za',
    dateAdvertised: '2026-03-26',
    askingPriceExVat: 845000,
  }),
  listing({
    id: 'seed-case-jxu110-06',
    modelId: 'case-ih-jxu-110-field-4wd-cab',
    yearModel: 2022,
    hours: 1300,
    province: 'KwaZulu-Natal',
    area: 'Richmond',
    sourceName: 'AutoTrader',
    sourceUrl: 'https://www.autotrader.co.za',
    dateAdvertised: '2026-03-28',
    askingPriceExVat: 910000,
  }),
  listing({
    id: 'seed-case-farmall110a-01',
    modelId: 'case-ih-farmall-110a-field-4wd-cab',
    yearModel: 2021,
    hours: 1700,
    province: 'Gauteng',
    area: 'Bapsfontein',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agrimag.co.za',
    dateAdvertised: '2026-03-24',
    askingPriceExVat: 895000,
  }),
  listing({
    id: 'seed-kubota-m9540-01',
    modelId: 'kubota-m9540-field-4wd-cab',
    yearModel: 2018,
    hours: 3900,
    province: 'Limpopo',
    area: 'Mokopane',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agtrader.co.za',
    dateAdvertised: '2026-03-08',
    askingPriceExVat: 655000,
  }),
  listing({
    id: 'seed-kubota-m108s-01',
    modelId: 'kubota-m108s-field-4wd-cab',
    yearModel: 2019,
    hours: 3400,
    province: 'Mpumalanga',
    area: 'Carolina',
    sourceName: 'AutoTrader',
    sourceUrl: 'https://www.autotrader.co.za',
    dateAdvertised: '2026-03-16',
    askingPriceExVat: 760000,
  }),
  listing({
    id: 'seed-same-explorer110-01',
    modelId: 'same-explorer-110-field-4wd-cab',
    yearModel: 2020,
    hours: 2500,
    province: 'Western Cape',
    area: 'Ceres',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agrisales.co.za',
    dateAdvertised: '2026-03-20',
    askingPriceExVat: 805000,
  }),
  listing({
    id: 'seed-landini-powerfarm110-01',
    modelId: 'landini-powerfarm-110-field-4wd-cab',
    yearModel: 2020,
    hours: 2800,
    province: 'Northern Cape',
    area: 'Douglas',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agrimag.co.za',
    dateAdvertised: '2026-03-18',
    askingPriceExVat: 795000,
  }),
  listing({
    id: 'seed-mahindra-9500-01',
    modelId: 'mahindra-9500-field-4wd-cab',
    yearModel: 2019,
    hours: 3200,
    province: 'Limpopo',
    area: 'Louis Trichardt',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agtrader.co.za',
    dateAdvertised: '2026-03-15',
    askingPriceExVat: 690000,
  }),
  listing({
    id: 'seed-valtra-a104-01',
    modelId: 'valtra-a104-field-4wd-cab',
    yearModel: 2021,
    hours: 2200,
    province: 'Free State',
    area: 'Reitz',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agrisales.co.za',
    dateAdvertised: '2026-03-21',
    askingPriceExVat: 920000,
  }),
  listing({
    id: 'seed-claas-elios240-01',
    modelId: 'claas-elios-240-field-4wd-cab',
    yearModel: 2022,
    hours: 900,
    province: 'Western Cape',
    area: 'Stellenbosch',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agrimag.co.za',
    dateAdvertised: '2026-03-27',
    askingPriceExVat: 840000,
  }),
  listing({
    id: 'seed-jd-5090gf-01',
    modelId: 'john-deere-5090gf-orchard-4wd-cab',
    yearModel: 2021,
    hours: 1800,
    province: 'Western Cape',
    area: 'Robertson',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agtrader.co.za',
    dateAdvertised: '2026-03-18',
    askingPriceExVat: 785000,
  }),
  listing({
    id: 'seed-nh-t4110v-01',
    modelId: 'new-holland-t4-110v-orchard-4wd-cab',
    yearModel: 2022,
    hours: 1100,
    province: 'Western Cape',
    area: 'Paarl',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agrisales.co.za',
    dateAdvertised: '2026-03-25',
    askingPriceExVat: 895000,
  }),
  listing({
    id: 'seed-same-frutteto90-01',
    modelId: 'same-frutteto-90-orchard-4wd-cab',
    yearModel: 2020,
    hours: 1600,
    province: 'Western Cape',
    area: 'Worcester',
    sourceName: 'Dealer Network',
    sourceUrl: 'https://www.agrimag.co.za',
    dateAdvertised: '2026-03-22',
    askingPriceExVat: 760000,
  }),
];

export const equipmentTypes: EquipmentTypeOption[] = [
  { key: 'tractor', label: 'Tractor', imageSrc: '/brand/Tractor.png', active: true },
  { key: 'combine', label: 'Combine', imageSrc: '/brand/Combine.png', active: false },
  { key: 'baler', label: 'Baler', imageSrc: '/brand/Baler.png', active: false },
  { key: 'sprayer', label: 'Sprayer', imageSrc: '/brand/Sprayer.png', active: false },
];

export function formatCurrency(value: number): string {
  return `R${Math.round(value).toLocaleString('en-ZA')}`;
}

export function formatHours(value: number): string {
  return `${Math.round(value).toLocaleString('en-ZA')} engine hours`;
}

export function labelTractorType(value: TractorType): string {
  return value === 'orchard' ? 'Orchard tractor' : 'Field tractor';
}

export function labelDriveType(value: DriveType): string {
  if (value === '2wd') return '2WD';
  if (value === '4wd') return '4WD';
  return 'Tracks';
}

export function labelCabType(value: CabType): string {
  return value === 'open-station' ? 'Open station' : 'Cab';
}

export function buildSpecLabel(input: {
  tractorType: TractorType;
  drive: DriveType;
  cab: CabType;
}): string {
  return [
    labelTractorType(input.tractorType),
    labelDriveType(input.drive),
    labelCabType(input.cab),
  ].join(' • ');
}

export function normalizeBrandSlug(value: string): string {
  return slugify(value);
}

export function getBrandBySlug(slug: string): BrandRow | undefined {
  return brands.find((brand) => brand.slug === slug);
}

export function getModelsByBrandSlug(brandSlug: string, tractorType?: TractorType): TractorCatalogRow[] {
  return tractors.filter((tractor) => {
    if (tractor.brandSlug !== brandSlug) return false;
    if (tractorType && tractor.tractorType !== tractorType) return false;
    return true;
  });
}

export function getModelById(id: string): TractorCatalogRow | undefined {
  return tractors.find((tractor) => tractor.id === id);
}

export function getConditionByKey(key: ConditionKey): ConditionOption {
  return conditionOptions.find((condition) => condition.key === key) ?? conditionOptions[1];
}

export function findDepartmentBand(powerKw: number, drive: DriveType, tractorType: TractorType): DepartmentBand {
  return (
    departmentBands.find(
      (band) =>
        band.tractorType === tractorType &&
        band.drive === drive &&
        powerKw >= band.minKw &&
        powerKw <= band.maxKw,
    ) ??
    departmentBands.find((band) => band.tractorType === tractorType && band.drive === drive) ??
    departmentBands[0]
  );
}

export function getComparableListings(input: {
  modelId: string;
  yearModel: number;
  hours: number;
  yearTolerance?: number;
  hourTolerance?: number;
}): MarketplaceListing[] {
  const yearTolerance = input.yearTolerance ?? 2;
  const hourTolerance = input.hourTolerance ?? 1000;

  const exact = listings.filter(
    (listing) =>
      listing.modelId === input.modelId &&
      Math.abs(listing.yearModel - input.yearModel) <= yearTolerance &&
      Math.abs(listing.hours - input.hours) <= hourTolerance,
  );

  if (exact.length) {
    return exact.sort((a, b) => a.askingPriceExVat - b.askingPriceExVat);
  }

  return listings
    .filter((listing) => listing.modelId === input.modelId)
    .sort((a, b) => a.askingPriceExVat - b.askingPriceExVat);
}

export type CalculatedValuation = {
  selectedModel: TractorCatalogRow;
  selectedCondition: ConditionOption;
  departmentBand: DepartmentBand;
  comparableListings: MarketplaceListing[];
  selectedComparable: MarketplaceListing | null;
  aim4priceValueExVat: number;
  marketRangeLowExVat: number;
  marketRangeHighExVat: number;
  marketAverageExVat: number;
  dalrrdReferenceExVat: number;
  selectedValueExVat: number;
  confidence: 'high' | 'medium' | 'low';
};

export function calculateValuation(input: {
  modelId: string;
  yearModel: number;
  hours: number;
  conditionKey: ConditionKey;
}): CalculatedValuation {
  const selectedModel = getModelById(input.modelId);

  if (!selectedModel) {
    throw new Error(`Model not found: ${input.modelId}`);
  }

  const selectedCondition = getConditionByKey(input.conditionKey);
  const departmentBand = findDepartmentBand(
    selectedModel.powerKw,
    selectedModel.drive,
    selectedModel.tractorType,
  );

  const comparableListings = getComparableListings({
    modelId: selectedModel.id,
    yearModel: input.yearModel,
    hours: input.hours,
  });

  const selectedComparable = comparableListings[0] ?? null;

  const age = Math.max(0, new Date().getFullYear() - input.yearModel);
  const ageFactor = Math.max(0.5, 1 - age * 0.055);
  const usageAdjustment = Math.max(0.7, 1 - Math.max(0, input.hours - 2500) * 0.000025);

  const aim4priceValueExVat = Math.round(
    selectedModel.replacementPriceExVat * ageFactor * usageAdjustment * selectedCondition.factor,
  );

  const marketPrices = comparableListings.map((listing) => listing.askingPriceExVat);
  const marketRangeLowExVat = marketPrices.length ? Math.min(...marketPrices) : aim4priceValueExVat;
  const marketRangeHighExVat = marketPrices.length ? Math.max(...marketPrices) : aim4priceValueExVat;
  const marketAverageExVat = marketPrices.length
    ? Math.round(marketPrices.reduce((sum, value) => sum + value, 0) / marketPrices.length)
    : aim4priceValueExVat;

  const dalrrdReferenceExVat = Math.max(
    Math.round(
      departmentBand.replacementExVat -
        input.hours * departmentBand.depreciationPerHourExVat,
    ),
    Math.round(departmentBand.replacementExVat * departmentBand.salvageFloorPct),
  );

  const selectedValueExVat = marketPrices.length ? marketAverageExVat : aim4priceValueExVat;

  const confidence: 'high' | 'medium' | 'low' =
    comparableListings.length >= 5 ? 'high' : comparableListings.length >= 2 ? 'medium' : 'low';

  return {
    selectedModel,
    selectedCondition,
    departmentBand,
    comparableListings,
    selectedComparable,
    aim4priceValueExVat,
    marketRangeLowExVat,
    marketRangeHighExVat,
    marketAverageExVat,
    dalrrdReferenceExVat,
    selectedValueExVat,
    confidence,
  };
}
