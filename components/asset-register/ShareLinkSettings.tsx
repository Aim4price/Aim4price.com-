'use client';

import { useState } from 'react';
import AssetAccessSettingsDialog from './AssetAccessSettingsDialog';
import ShareLinkPasswordStep, { type LinkPasswordChoice } from './ShareLinkPasswordStep';
import { DealerMaintenancePermissionPicker } from '../DealerMaintenanceAccessSettings';
import { normalizeExternalPermissions, readOnlyAssetLinkPermissions, type ExternalSharePermissions } from '../../lib/external-share-permissions';
import assetStyles from '../../app/asset-register/page.module.css';

export default function ShareLinkSettings({ token, subject, initialPermissions, initialProtected = false, onClose, onSaved }: {
  token: string;
  subject: string;
  initialPermissions: ExternalSharePermissions;
  initialProtected?: boolean;
  onClose: () => void;
  onSaved: (permissions: ExternalSharePermissions, protectedLink: boolean) => void;
}) {
  const [permissions, setPermissions] = useState(() => normalizeExternalPermissions(initialPermissions));
  const [step, setStep] = useState<'permissions' | 'password'>('permissions');
  const [choice, setChoice] = useState<LinkPasswordChoice | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const choosingPassword = step === 'password';
  const canSave = choosingPassword && choice !== null && (choice !== 'set' || (password.length >= 8 && password.length <= 128)) && !busy;

  async function save() {
    if (!canSave) return;

    setBusy(true);
    setError('');
    const passwordUpdate = choice === 'set' ? { password } : choice === 'remove' ? { password: '' } : {};
    try {
      const response = await fetch('/api/asset-share-links/history', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, permissions, ...passwordUpdate }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update access. Please try again.');
      onSaved(data.permissions, data.protected === true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update access. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <AssetAccessSettingsDialog
    title={choosingPassword ? 'Protect your asset link' : 'Asset link settings'}
    assetTitle={subject}
    linkSettings
    guideLayout={choosingPassword}
    focusSelector={choosingPassword ? '[data-link-password-choices] button' : 'input'}
    onViewOnly={choosingPassword || permissions.documents ? undefined : () => setPermissions({
      ...readOnlyAssetLinkPermissions(permissions),
      reports: permissions.reports,
      allReports: permissions.allReports,
      documents: permissions.documents,
      directUpdates: permissions.directUpdates,
    })}
    onClose={() => { if (!busy) onClose(); }}
    footer={<div data-access-actions className={`${assetStyles.formActions} ${assetStyles.exportActions} ${assetStyles.quoteTrackingSettingsActions}`}>
      {choosingPassword ? <>
        <button type="button" className={assetStyles.secondaryButton} disabled={busy} onClick={() => { setError(''); setStep('permissions'); }}>Back</button>
        <button type="button" className={assetStyles.primaryButton} disabled={!canSave} onClick={() => void save()}>{busy ? 'Saving…' : 'Save changes'}</button>
      </> : <>
        <button type="button" className={assetStyles.secondaryButton} onClick={onClose}>Cancel</button>
        <button type="button" className={assetStyles.primaryButton} onClick={() => setStep('password')}>Next</button>
      </>}
    </div>}
  >
    {choosingPassword ? (
      <ShareLinkPasswordStep
        choice={choice}
        password={password}
        protectedLink={initialProtected}
        disabled={busy}
        onChoiceChange={option => {
          setChoice(option);
          if (option !== 'set') setPassword('');
          setError('');
        }}
        onPasswordChange={setPassword}
      />
    ) : (
      <DealerMaintenancePermissionPicker
        marketPrice={{
          enabled: permissions.marketPrice === true,
          onChange: enabled => setPermissions(current => ({ ...current, marketPrice: enabled })),
        }}
        value={{
          canViewHistory: permissions.history === true,
          canSuggestCurrentValue: permissions.suggestValue === true,
          canUpdateDetails: permissions.updateDetails === true,
          canAccessLocation: permissions.location === true,
          canUpdateYear: permissions.yearModel === true,
          canUpdateUsage: permissions.usage === true,
          canUpdateCondition: permissions.condition === true,
          canAddMaintenance: permissions.addMaintenance === true,
          canViewParts: permissions.viewParts === true,
          canAddParts: permissions.addParts === true,
          canAddDocuments:permissions.addDocuments===true,canAddPhotos: permissions.addPhotos === true,
          canAddCosts: permissions.addCosts === true,
          canViewLoggedProblems: permissions.loggedProblems === true,
          canViewMaintenanceReports: permissions.maintenanceReports === true,
          canViewCostOfOwnership: permissions.costOfOwnership === true,
          canCreateMaintenanceSchedules: permissions.maintenanceSchedules === true,
          canUpdateSerial: permissions.serialNumber,
          canUpdateReplacementPrice: permissions.replacementPrice,
        }}
        onChange={(value, marketPriceEnabled) => setPermissions(current => normalizeExternalPermissions({
          ...current,
          history: value.canViewHistory,
          suggestValue: value.canSuggestCurrentValue,
          marketPrice: marketPriceEnabled ?? current.marketPrice,
          updateDetails: value.canUpdateDetails,
          location: value.canAccessLocation,
          yearModel: value.canUpdateYear,
          usage: value.canUpdateUsage,
          condition: value.canUpdateCondition,
          addMaintenance: value.canAddMaintenance,
          viewParts: value.canViewParts,
          addParts: value.canAddParts,
          addDocuments:value.canAddDocuments,addPhotos: value.canAddPhotos,
          addCosts: value.canAddCosts,
          loggedProblems: value.canViewLoggedProblems,
          maintenanceReports: value.canViewMaintenanceReports,
          costOfOwnership: value.canViewCostOfOwnership,
          maintenanceSchedules: value.canCreateMaintenanceSchedules,
          serialNumber: value.canUpdateSerial,
          replacementPrice: value.canUpdateReplacementPrice,
        }))}
      />
    )}
    {error && <p role="alert">{error}</p>}
  </AssetAccessSettingsDialog>;
}
