export const BUSINESS_HEADINGS = [
  "Tractor dealer",
  "Vehicle dealer",
  "Equipment dealer",
  "Mechanic",
  "Auto electrician",
  "Parts supplier",
  "Tyre services",
  "Body repairer",
  "Hydraulic services",
  "Transport services",
  "Insurance broker",
  "Finance provider",
  "Licence renewal services",
];
export const BUSINESS_SERVICES = [
  "Air and cabin filter replacement",
  "Vehicle engine diagnostic",
  "Battery",
  "Brakes",
  "Electrical",
  "Oil change",
  "Steering and suspension repair",
  "Body & Trim",
  "Brake service & repair",
  "Exhaust",
  "Transmission",
  "Hydraulic repairs",
  "On-site repairs",
  "Parts supply",
  "Tyre replacement",
  "Equipment sales",
];
export type BusinessDetails = {
  name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  town: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  nationwide: boolean;
  headings: string[];
  services: string[];
  googlePlaceId: string;
  googleMapsUrl: string;
};
export type BusinessLeadView = {
  businessName: string;
  message: string;
  contact: { name: string; email: string; phone: string; additional: string };
  umbrella: string;
  assets: Array<{
    title: string;
    details: Array<[string, string]>;
    photos: string[];
  }>;
};
export const businessText = (value: unknown, max = 200) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
export function businessEmail(value: unknown): string {
  const email = businessText(value, 254).toLowerCase();
  if (!/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(email))
    throw new Error("Enter a valid email address.");
  return email;
}
export function businessUrl(value: unknown, googleOnly = false): string {
  const text = businessText(value, 1000);
  if (!text) return "";
  const url = new URL(text.startsWith("http") ? text : `https://${text}`);
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new Error("Use a valid website link.");
  if (url.username || url.password)
    throw new Error("Use a valid website link.");
  if (
    googleOnly &&
    ![
      "www.google.com",
      "google.com",
      "maps.google.com",
      "maps.app.goo.gl",
      "goo.gl",
    ].includes(url.hostname)
  )
    throw new Error("Use a Google Maps business link.");
  return url.toString();
}
export function validateBusinessDetails(
  input: Record<string, unknown>,
  email: string,
): BusinessDetails {
  const list = (value: unknown) =>
    Array.isArray(value)
      ? [
          ...new Set(value.map((v) => businessText(v, 100)).filter(Boolean)),
        ].slice(0, 30)
      : [];
  const number = (value: unknown) =>
    value === "" || value == null ? NaN : Number(value);
  const details: BusinessDetails = {
    name: businessText(input.name),
    email: businessEmail(email),
    phone: businessText(input.phone, 40),
    website: businessUrl(input.website),
    address: businessText(input.address, 300),
    town: businessText(input.town),
    latitude: number(input.latitude),
    longitude: number(input.longitude),
    radiusKm: number(input.radiusKm),
    nationwide: input.nationwide === true,
    headings: list(input.headings),
    services: list(input.services),
    googlePlaceId: businessText(input.googlePlaceId, 250),
    googleMapsUrl: businessUrl(input.googleMapsUrl, true),
  };
  if (
    details.name.length < 2 ||
    !details.town ||
    !details.headings.length ||
    !details.services.length
  )
    throw new Error("Add your business name, town, headings and services.");
  if (
    !Number.isFinite(details.latitude) ||
    Math.abs(details.latitude) > 90 ||
    !Number.isFinite(details.longitude) ||
    Math.abs(details.longitude) > 180
  )
    throw new Error("Choose your business location.");
  if (
    !Number.isFinite(details.radiusKm) ||
    details.radiusKm < 1 ||
    details.radiusKm > 2000
  )
    throw new Error("Choose a service distance between 1 and 2 000 km.");
  return details;
}
export function businessDistanceKm(
  a: number,
  b: number,
  c: number,
  d: number,
): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((c - a) * rad) / 2) ** 2 +
    Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(((d - b) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function businessCoversLocation(
  b: Pick<
    BusinessDetails,
    "latitude" | "longitude" | "radiusKm" | "nationwide"
  >,
  latitude: number,
  longitude: number,
): boolean {
  return (
    b.nationwide ||
    businessDistanceKm(b.latitude, b.longitude, latitude, longitude) <=
      b.radiusKm
  );
}

export function businessPartnerTypes(headings: string[]): Array<'dealer'|'finance'|'insurance'|'licensing'> {
  return [...new Set(headings.map(heading => {
    const label = heading.toLowerCase();
    if (label.includes('insurance')) return 'insurance' as const;
    if (label.includes('finance') || label.includes('accountant')) return 'finance' as const;
    if (label.includes('licence') || label.includes('license')) return 'licensing' as const;
    return 'dealer' as const;
  }))];
}
