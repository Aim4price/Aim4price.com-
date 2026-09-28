export const BUSINESS_SERVICE_OPTIONS = [
  { value: "insurance-services", label: "Insurance" },
  { value: "finance-services", label: "Finance" },
  { value: "licensing-services", label: "Licensing" },
  { value: "accounting-services", label: "Accounting / asset advice" },
  { value: "maintenance-services", label: "Repairs / maintenance" },
  { value: "contributor", label: "Other business" },
] as const;
export type BusinessService = typeof BUSINESS_SERVICE_OPTIONS[number]['value'];
export function isBusinessService(value: unknown): value is BusinessService {
  return BUSINESS_SERVICE_OPTIONS.some(option => option.value === value);
}
