import AssetPickerDetail from './AssetPickerDetail';

/** Shared identity line for saved-asset selection rows. */
export default function AssetSerialNumber({ value }: { value?: string | null }) {
  return <AssetPickerDetail serial>Serial / VIN: {value?.trim() || 'Not provided'}</AssetPickerDetail>;
}
