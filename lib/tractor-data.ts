export type TractorType = 'field' | 'orchard';
export type DriveType = '2wd' | '4wd';
export type CabType = 'cab' | 'open-station';
export type ConditionKey = 'excellent' | 'good' | 'fair' | 'used' | 'serious';
export type TractorCatalogRow = { id:string; brandSlug:string; brandName:string; modelName:string; tractorType:TractorType; drive:DriveType; cab:CabType; powerKw:number; yearStart:number; yearEnd:number; aim4priceReplacementExVat:number; };
export type DepartmentAgBand = { id:string; tractorType:TractorType; drive:DriveType; powerKw:number; replacementPriceExVat:number; depreciationPerHourExVat:number; };
export type MarketListing = { id:string; equipmentType:'tractor'; brandSlug:string; brandName:string; modelName:string; tractorType:TractorType; drive:DriveType; cab:CabType; powerKw:number; yearModel:number; hours:number; advertisedPriceExVat:number; province:string; area:string; sourceName:string; sourceUrl:string; dateAdvertised:string; };
export const brands = [
  { slug:'john-deere', name:'John Deere' }, { slug:'case-ih', name:'Case IH' }, { slug:'new-holland', name:'New Holland' }, { slug:'kubota', name:'Kubota' }, { slug:'landini', name:'Landini' }, { slug:'fendt', name:'Fendt' }, { slug:'deutz-fahr', name:'Deutz-Fahr' }, { slug:'massey-ferguson', name:'Massey Ferguson' }
];
export const tractors: TractorCatalogRow[] = [
  { id:'landini-solis-20-field-4wd-open', brandSlug:'landini', brandName:'Landini', modelName:'Solis 20', tractorType:'field', drive:'4wd', cab:'open-station', powerKw:13, yearStart:2010, yearEnd:2025, aim4priceReplacementExVat:200000 },
  { id:'landini-1-25h-field-2wd-open', brandSlug:'landini', brandName:'Landini', modelName:'1-25 H', tractorType:'field', drive:'2wd', cab:'open-station', powerKw:17, yearStart:2000, yearEnd:2025, aim4priceReplacementExVat:200000 },
  { id:'landini-rex4-080-orchard-4wd-cab', brandSlug:'landini', brandName:'Landini', modelName:'REX4 080F', tractorType:'orchard', drive:'4wd', cab:'cab', powerKw:55, yearStart:2019, yearEnd:2026, aim4priceReplacementExVat:1240000 },
  { id:'john-deere-6135b-field-4wd-cab', brandSlug:'john-deere', brandName:'John Deere', modelName:'6135B', tractorType:'field', drive:'4wd', cab:'cab', powerKw:99, yearStart:2016, yearEnd:2026, aim4priceReplacementExVat:1410000 },
  { id:'john-deere-6m120-field-4wd-cab', brandSlug:'john-deere', brandName:'John Deere', modelName:'6M 120', tractorType:'field', drive:'4wd', cab:'cab', powerKw:120, yearStart:2018, yearEnd:2026, aim4priceReplacementExVat:1595000 },
  { id:'john-deere-5100e-field-2wd-open', brandSlug:'john-deere', brandName:'John Deere', modelName:'5100E', tractorType:'field', drive:'2wd', cab:'open-station', powerKw:56, yearStart:2017, yearEnd:2026, aim4priceReplacementExVat:760000 },
  { id:'new-holland-t7210-field-4wd-cab', brandSlug:'new-holland', brandName:'New Holland', modelName:'T7.210', tractorType:'field', drive:'4wd', cab:'cab', powerKw:129, yearStart:2018, yearEnd:2026, aim4priceReplacementExVat:1675000 },
  { id:'case-ih-puma140-field-4wd-cab', brandSlug:'case-ih', brandName:'Case IH', modelName:'Puma 140', tractorType:'field', drive:'4wd', cab:'cab', powerKw:104, yearStart:2017, yearEnd:2026, aim4priceReplacementExVat:1485000 },
  { id:'kubota-m9540-field-4wd-open', brandSlug:'kubota', brandName:'Kubota', modelName:'M9540', tractorType:'field', drive:'4wd', cab:'open-station', powerKw:70, yearStart:2012, yearEnd:2021, aim4priceReplacementExVat:890000 }
];
export const departmentBands: DepartmentAgBand[] = [
  { id:'da-field-4wd-13', tractorType:'field', drive:'4wd', powerKw:13, replacementPriceExVat:221053, depreciationPerHourExVat:19.89 },
  { id:'da-field-2wd-17', tractorType:'field', drive:'2wd', powerKw:17, replacementPriceExVat:263158, depreciationPerHourExVat:23.68 },
  { id:'da-field-4wd-56', tractorType:'field', drive:'4wd', powerKw:56, replacementPriceExVat:595119, depreciationPerHourExVat:53.56 },
  { id:'da-field-4wd-70', tractorType:'field', drive:'4wd', powerKw:70, replacementPriceExVat:950000, depreciationPerHourExVat:109.5 },
  { id:'da-field-4wd-99', tractorType:'field', drive:'4wd', powerKw:99, replacementPriceExVat:1295000, depreciationPerHourExVat:154.25 },
  { id:'da-field-4wd-104', tractorType:'field', drive:'4wd', powerKw:104, replacementPriceExVat:1395000, depreciationPerHourExVat:164.1 },
  { id:'da-field-4wd-120', tractorType:'field', drive:'4wd', powerKw:120, replacementPriceExVat:1480000, depreciationPerHourExVat:178.5 },
  { id:'da-field-4wd-129', tractorType:'field', drive:'4wd', powerKw:129, replacementPriceExVat:1660000, depreciationPerHourExVat:192 },
  { id:'da-orchard-4wd-55', tractorType:'orchard', drive:'4wd', powerKw:55, replacementPriceExVat:1125000, depreciationPerHourExVat:118.5 }
];
export const listings: MarketListing[] = [
  { id:'m1', equipmentType:'tractor', brandSlug:'john-deere', brandName:'John Deere', modelName:'6M 120', tractorType:'field', drive:'4wd', cab:'cab', powerKw:120, yearModel:2019, hours:3000, advertisedPriceExVat:780000, province:'Free State', area:'Bothaville', sourceName:'Prototype AutoTrader', sourceUrl:'https://example.com/jd-6m120-1', dateAdvertised:'2026-02-10' },
  { id:'m2', equipmentType:'tractor', brandSlug:'john-deere', brandName:'John Deere', modelName:'6M 120', tractorType:'field', drive:'4wd', cab:'cab', powerKw:120, yearModel:2020, hours:3500, advertisedPriceExVat:845000, province:'Mpumalanga', area:'Ermelo', sourceName:'Prototype Market Vault', sourceUrl:'https://example.com/jd-6m120-2', dateAdvertised:'2026-03-01' },
  { id:'m3', equipmentType:'tractor', brandSlug:'john-deere', brandName:'John Deere', modelName:'6M 120', tractorType:'field', drive:'4wd', cab:'cab', powerKw:120, yearModel:2022, hours:4100, advertisedPriceExVat:910000, province:'KwaZulu-Natal', area:'Winterton', sourceName:'Prototype Dealer Network', sourceUrl:'https://example.com/jd-6m120-3', dateAdvertised:'2026-03-12' },
  { id:'m4', equipmentType:'tractor', brandSlug:'john-deere', brandName:'John Deere', modelName:'6135B', tractorType:'field', drive:'4wd', cab:'cab', powerKw:99, yearModel:2020, hours:4200, advertisedPriceExVat:760000, province:'North West', area:'Lichtenburg', sourceName:'Prototype Market Vault', sourceUrl:'https://example.com/jd-6135b-1', dateAdvertised:'2026-01-09' },
  { id:'m5', equipmentType:'tractor', brandSlug:'john-deere', brandName:'John Deere', modelName:'6135B', tractorType:'field', drive:'4wd', cab:'cab', powerKw:99, yearModel:2021, hours:3500, advertisedPriceExVat:845000, province:'Free State', area:'Reitz', sourceName:'Prototype Dealer Network', sourceUrl:'https://example.com/jd-6135b-2', dateAdvertised:'2026-03-13' },
  { id:'m6', equipmentType:'tractor', brandSlug:'landini', brandName:'Landini', modelName:'Solis 20', tractorType:'field', drive:'4wd', cab:'open-station', powerKw:13, yearModel:2020, hours:1200, advertisedPriceExVat:145000, province:'Western Cape', area:'Ceres', sourceName:'Prototype Market Vault', sourceUrl:'https://example.com/landini-solis20-1', dateAdvertised:'2026-02-21' },
  { id:'m7', equipmentType:'tractor', brandSlug:'landini', brandName:'Landini', modelName:'Solis 20', tractorType:'field', drive:'4wd', cab:'open-station', powerKw:13, yearModel:2021, hours:1600, advertisedPriceExVat:162000, province:'KwaZulu-Natal', area:'Pietermaritzburg', sourceName:'Prototype Dealer Network', sourceUrl:'https://example.com/landini-solis20-2', dateAdvertised:'2026-03-15' },
  { id:'m8', equipmentType:'tractor', brandSlug:'landini', brandName:'Landini', modelName:'Solis 20', tractorType:'field', drive:'4wd', cab:'open-station', powerKw:13, yearModel:2022, hours:1900, advertisedPriceExVat:175000, province:'Eastern Cape', area:'Kirkwood', sourceName:'Prototype Auction Feed', sourceUrl:'https://example.com/landini-solis20-3', dateAdvertised:'2026-03-20' },
  { id:'m9', equipmentType:'tractor', brandSlug:'new-holland', brandName:'New Holland', modelName:'T7.210', tractorType:'field', drive:'4wd', cab:'cab', powerKw:129, yearModel:2020, hours:3700, advertisedPriceExVat:900000, province:'Free State', area:'Bethlehem', sourceName:'Prototype Market Vault', sourceUrl:'https://example.com/nh-t7210-1', dateAdvertised:'2026-03-11' },
  { id:'m10', equipmentType:'tractor', brandSlug:'kubota', brandName:'Kubota', modelName:'M9540', tractorType:'field', drive:'4wd', cab:'open-station', powerKw:70, yearModel:2018, hours:4200, advertisedPriceExVat:515000, province:'Northern Cape', area:'Upington', sourceName:'Prototype Dealer Network', sourceUrl:'https://example.com/kubota-m9540-1', dateAdvertised:'2026-03-07' },
  { id:'m11', equipmentType:'tractor', brandSlug:'landini', brandName:'Landini', modelName:'REX4 080F', tractorType:'orchard', drive:'4wd', cab:'cab', powerKw:55, yearModel:2021, hours:2400, advertisedPriceExVat:760000, province:'Western Cape', area:'Paarl', sourceName:'Prototype Orchard Network', sourceUrl:'https://example.com/landini-rex-1', dateAdvertised:'2026-03-06' }
];
export const conditionOptions = [
  { key:'excellent', label:'Excellent' },
  { key:'good', label:'Good' },
  { key:'fair', label:'Fair' },
  { key:'used', label:'Used' },
  { key:'serious', label:'Requires Attention' }
] as const;
