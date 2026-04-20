import ScanClient from './scan-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = {
  params: {
    publicAssetCode: string;
  };
};

export default function ScanAssetPage({ params }: PageProps) {
  return <ScanClient publicAssetCode={params.publicAssetCode ?? ''} />;
}
