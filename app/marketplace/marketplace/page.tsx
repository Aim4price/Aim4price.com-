import MarketplaceClient from './marketplace-client';

type SearchParamValue = string | string[] | undefined;

type MarketplacePageProps = {
  searchParams?: {
    brand?: SearchParamValue;
    model?: SearchParamValue;
    drive?: SearchParamValue;
    type?: SearchParamValue;
  };
};

function pick(value: SearchParamValue): string {
  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim();
  }

  return String(value ?? '').trim();
}

export default function MarketplacePage({ searchParams }: MarketplacePageProps) {
  return (
    <MarketplaceClient
      initialFilters={{
        brand: pick(searchParams?.brand),
        model: pick(searchParams?.model),
        drive: pick(searchParams?.drive),
        type: pick(searchParams?.type),
      }}
    />
  );
}
