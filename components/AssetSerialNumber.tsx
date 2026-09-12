/** Shared identity line for saved-asset selection rows. */
export default function AssetSerialNumber({ value }: { value?: string | null }) {
  return <small data-asset-choice-secondary="true">Serial number: {value?.trim() || 'Not provided'}</small>;
}
