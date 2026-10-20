import type { AssetOption } from './my-invoices-client';
import AssetPickerDetail from '../../components/AssetPickerDetail';
import AssetSerialNumber from '../../components/AssetSerialNumber';

/** Uses the standard saved-asset identity layout. */
export default function ManualCostAssetDetails({ asset }: { asset: AssetOption }) {
  return <>
    <small data-asset-choice-meta="true">{asset.meta}</small>
    <AssetPickerDetail>{asset.categoryLabel} · {asset.selectedMethod === 'manual' ? 'Manual' : 'Aim4price'}</AssetPickerDetail>
    <AssetSerialNumber value={asset.serialNumber} />
  </>;
}
