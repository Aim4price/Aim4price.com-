import ScanClient from '../../../scan/[publicAssetCode]/scan-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = {
  params: {
    publicAssetCode: string;
  };
};

export default function FieldManagerAssetUpdatePage({ params }: PageProps) {
  return <ScanClient publicAssetCode={params.publicAssetCode ?? ''} fieldManagerMode />;
}
