export type AssetPart = {
  id: string; itemKey: string; itemLabel: string; name: string; partNumber: string;
  revision?: number; canEdit?: boolean; brand: string; notes: string; maintenanceId: string | null; addedBy: string; createdAt: string;
};
export type PartSuggestion = { id: string; label: string };
export type PartsData = {
  parts: AssetPart[]; suggestions: PartSuggestion[]; family: string;
  canView: boolean; canAdd: boolean; canManageChoices?: boolean;
  maintenance: { id: string; title: string; status: string }[];
};
export function validateAssetPart(value: Record<string, unknown>) {
  const text = (key: string, max: number, required = false) => {
    const v = value[key] ?? '';
    if (typeof v !== 'string' || v.length > max || (required && !v.trim())) throw new Error(`Enter a valid ${key === 'partNumber' ? 'part number' : key}.`);
    return v.trim();
  };
  const id = text('requestId', 36, true);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(id)) throw new Error('This save needs a valid identifier. Reopen the form.');
  const maintenanceId = text('maintenanceId', 36);
  if (maintenanceId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(maintenanceId)) throw new Error('Choose a maintenance record.');
  return { id, itemKey: text('itemKey', 200, true), name: text('name', 160, true), partNumber: text('partNumber', 120, true), brand: text('brand', 120), notes: text('notes', 2000), maintenanceId: maintenanceId || null };
}
