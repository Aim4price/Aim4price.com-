'use client';
import AssetConditionPicker from './AssetConditionPicker';
import type { ReactNode } from 'react';
import styles from '../app/asset-register/page.module.css';
export const ASSET_CONDITION_OPTIONS = [{ value: '', label: 'Select condition' }, { value: 'excellent', label: 'Excellent' }, { value: 'good', label: 'Good' }, { value: 'fair', label: 'Fair' }, { value: 'used', label: 'Used' }, { value: 'serious', label: 'Requires attention' }];
export default function AssetDetailsFields({ year, usage, condition, onYear, onUsage, onCondition, yearLabel = 'Year model', usageLabel = 'Usage', canYear = true, canUsage = true, canCondition = true, usageControl, conditionControl, className }: {
    year: string;
    usage?: string;
    condition?: string;
    onYear: (v: string) => void;
    onUsage?: (v: string) => void;
    onCondition?: (v: string) => void;
    yearLabel?: string;
    usageLabel?: string;
    canYear?: boolean;
    canUsage?: boolean;
    canCondition?: boolean;
    usageControl?: ReactNode;
    conditionControl?: ReactNode;
    className?: string;
}) {
    return <div className={className || styles.assetTripleGrid}>
 {canYear && <label className={styles.field} data-asset-detail-edit-target="year"><span>{yearLabel}</span><input type="number" min="1800" max={new Date().getFullYear() + 1} step="1" value={year} onChange={e => onYear(e.target.value)} placeholder="Optional"/></label>}
 {canUsage && (usageControl || <label className={styles.field} data-asset-detail-edit-target="usage"><span>{usageLabel}</span><input type="number" min="0" step="0.1" value={usage} onChange={e => onUsage?.(e.target.value)}/></label>)}
 {canCondition && (conditionControl || <div className={styles.field} data-asset-detail-edit-target="condition"><span>Condition</span><AssetConditionPicker value={condition} onChange={value=>onCondition?.(value)}/></div>)}
 </div>;
}
