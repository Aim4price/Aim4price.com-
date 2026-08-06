'use client';

import FuelLocationModal, { type FuelLocationCoordinates } from '../../components/FuelLocationModal';
import { saveFieldManagerServiceLocation } from '../../lib/field-manager-location-session';

type OwnerServiceLocationModalProps = {
  assetTitle: string;
  assetId: string;
  publicAssetCode: string;
  redirectTo: string;
  onCancel: () => void;
  onError: (message: string) => void;
};

export default function OwnerServiceLocationModal({
  assetTitle,
  assetId,
  publicAssetCode,
  redirectTo,
  onCancel,
  onError,
}: OwnerServiceLocationModalProps) {
  function handleReady(coordinates: FuelLocationCoordinates) {
    const saved = saveFieldManagerServiceLocation({
      publicAssetCode,
      assetId,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      accuracyMeters: coordinates.accuracyMeters,
      capturedAtIso: coordinates.capturedAtIso,
    });

    if (!saved) {
      onError('Your location was found but could not be prepared for this service. Please retry.');
      onCancel();
      return;
    }

    window.location.assign(redirectTo);
  }

  return (
    <FuelLocationModal
      subject={assetTitle}
      recordLabel="service"
      onReady={handleReady}
      onCancel={onCancel}
    />
  );
}
