import { BUSINESS_SERVICE_OPTIONS, type BusinessService } from "./business-service-options";

type SelectOption<T> = { value: T; label: string };
export type SignupAccountType = "business" | "owner" | "middleman" | "dealer";
export type SignupAccountSubtype =
  | BusinessService
  | "contributor"
  | "farmer"
  | "contractor"
  | "construction-company"
  | "asset-owner"
  | "bank"
  | "finance-house"
  | "accountant"
  | "short-term-insurer"
  | "machinery-dealer"
  | "motor-dealer"
  | "auctioneer"
  | "equipment-middleman"
  | "licence-renewal-expert"
  | "fleet-licensing-service";

export type PublicSignupAccountType = "owner" | "business";
export const PUBLIC_SIGNUP_OPTIONS: Array<SelectOption<PublicSignupAccountType>> = [
  { value: "owner", label: "Owner" },
  { value: "business", label: "Business" },
];

export const SIGNUP_ACCOUNT_TYPE_OPTIONS: Array<SelectOption<SignupAccountType>> = [
  { value: "owner", label: "Owner" },
  { value: "dealer", label: "Business" },
  { value: "business", label: "Free Business" },
  { value: "middleman", label: "Middleman" },
];

export const SIGNUP_ACCOUNT_SUBTYPE_OPTIONS: Record<
  SignupAccountType,
  Array<SelectOption<SignupAccountSubtype>>
> = {
  business: [...BUSINESS_SERVICE_OPTIONS],
  owner: [
    { value: "farmer", label: "Farmer / farm owner" },
    { value: "contractor", label: "Contractor / operator" },
    { value: "construction-company", label: "Construction company" },
    { value: "asset-owner", label: "Private / fleet asset owner" },
  ],
  middleman: [
    { value: "equipment-middleman", label: "Equipment middleman" },
  ],
  dealer: [
    { value: "machinery-dealer", label: "Machinery dealer" },
    { value: "motor-dealer", label: "Motor dealer" },
    { value: "auctioneer", label: "Auctioneer / broker" },
    ...BUSINESS_SERVICE_OPTIONS,
  ],
};

export function workspaceLabel(type: string, subtype: string) {
  if (type === "dealer" && ["equipment-middleman", "machinery-middleman", "middleman"].includes(subtype)) return "Middleman";
  return SIGNUP_ACCOUNT_TYPE_OPTIONS.find(option => option.value === type)?.label ?? type;
}

export function adminAccountLabel(type: string, subtype: string, paidBusiness = false) {
  const workspace = workspaceLabel(type, subtype);
  if (workspace === "Middleman") return workspace;
  if (type === "dealer" || type === "business") {
    return type === "dealer" || paidBusiness ? "Paid Business Account" : "Free Business Account";
  }
  return workspace;
}

export function adminCategoryLabel(subtype: string, fallback: string) {
  if (subtype === "machinery-dealer") return "Machinery business";
  if (subtype === "motor-dealer") return "Motor business";
  return fallback;
}
