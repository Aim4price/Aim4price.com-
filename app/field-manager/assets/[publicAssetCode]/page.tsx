import ScanClient from '../../../scan/[publicAssetCode]/scan-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = {
  params: {
    publicAssetCode: string;
  };
  searchParams?: {
    assetId?: string;
  };
};

export default function FieldManagerAssetUpdatePage({ params, searchParams }: PageProps) {
  return (
    <ScanClient
      publicAssetCode={params.publicAssetCode ?? ''}
      fieldManagerMode
      fieldManagerAssetId={searchParams?.assetId ?? null}
    />
  );
}
