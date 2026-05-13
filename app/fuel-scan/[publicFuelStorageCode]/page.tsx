import FuelScanClient from './fuel-scan-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FuelScanPageProps = {
  params: {
    publicFuelStorageCode: string;
  };
};

export default function FuelScanPage({ params }: FuelScanPageProps) {
  return <FuelScanClient publicFuelStorageCode={params.publicFuelStorageCode} />;
}
