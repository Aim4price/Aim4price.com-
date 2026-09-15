export type AssetChecklistItem = {
  id: string;
  mode: 'checked' | 'serviced' | 'repaired';
  label: string;
  description: string;
};

export function validateAssetChecklistItem(input: unknown): Omit<AssetChecklistItem, 'id'> {
  const item = input as Partial<AssetChecklistItem> | null;
  if (!item || !['checked', 'serviced', 'repaired'].includes(String(item.mode))) throw new Error('Choose inspection, service or maintenance.');
  if (typeof item.label !== 'string' || !item.label.trim() || item.label.trim().length > 160 || /[\u0000-\u001f]/.test(item.label)) throw new Error('Enter an item name of up to 160 characters.');
  if (typeof item.description !== 'string' || item.description.trim().length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(item.description)) throw new Error('Keep instructions to 500 characters.');
  return { mode: item.mode!, label: item.label.trim(), description: item.description.trim() };
}
