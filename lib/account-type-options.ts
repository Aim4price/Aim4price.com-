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

export const SIGNUP_ACCOUNT_TYPE_OPTIONS: Array<SelectOption<SignupAccountType>> = [
  { value: "owner", label: "Owner" },
  { value: "dealer", label: "Dealer" },
  { value: "business", label: "Business" },
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
  ],
};

export function workspaceLabel(type: string, subtype: string) {
  if (type === "dealer" && ["equipment-middleman", "machinery-middleman", "middleman"].includes(subtype)) return "Middleman";
  return SIGNUP_ACCOUNT_TYPE_OPTIONS.find(option => option.value === type)?.label ?? type;
}
