import FuelScanClient from '../../../fuel-scan/[publicFuelStorageCode]/fuel-scan-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = {
  params: {
    publicFuelStorageCode: string;
  };
};

export default function FieldManagerDieselUpdatePage({ params }: PageProps) {
  return <FuelScanClient publicFuelStorageCode={params.publicFuelStorageCode ?? ''} fieldManagerMode />;
}
