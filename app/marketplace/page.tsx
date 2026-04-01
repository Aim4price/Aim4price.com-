import MarketplaceClient from './marketplace-client';

type SearchParams = {
  brand?: string | string[];
  model?: string | string[];
  drive?: string | string[];
  type?: string | string[];
};

function pick(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function MarketplacePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const initialFilters = {
    brand: pick(searchParams?.brand),
    model: pick(searchParams?.model),
    drive: pick(searchParams?.drive),
    type: pick(searchParams?.type),
  };

  return <MarketplaceClient initialFilters={initialFilters} />;
}
