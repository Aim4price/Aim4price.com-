export type SavedItem = {
  id: string;
  kind: 'tractor' | 'manual' | 'property';
  title: string;
  brandName?: string;
  modelName?: string;
  drive?: string;
  tractorType?: string;
  yearModel?: number;
  hours?: number;
  selectedMethod: 'aim4price' | 'market' | 'department' | 'manual';
  selectedValueExVat: number;
  aim4priceValueExVat?: number | null;
  marketMidExVat?: number | null;
  departmentValueExVat?: number | null;
  note?: string;
  createdAtIso: string;
};
const KEY = 'aim4price-tractors-kit-register';
function ok(){ return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'; }
export function loadItems(): SavedItem[]{ if(!ok()) return []; const raw=window.localStorage.getItem(KEY); if(!raw) return []; try { const parsed=JSON.parse(raw); return Array.isArray(parsed)?parsed:[]; } catch { return []; } }
export function saveItem(item: SavedItem){ const current=loadItems(); const next=[item, ...current.filter(i=>i.id!==item.id)]; if(ok()) window.localStorage.setItem(KEY, JSON.stringify(next)); return next; }
export function deleteItem(id:string){ const next=loadItems().filter(i=>i.id!==id); if(ok()) window.localStorage.setItem(KEY, JSON.stringify(next)); return next; }
export function clearItems(){ if(ok()) window.localStorage.removeItem(KEY); }
