export type LocationDraft = { locationText: string; latitude: string; longitude: string };

type SavedLocation = {
  lastKnownLocationText?: string | null;
  lastKnownLat?: number | null;
  lastKnownLng?: number | null;
};

export function assetLocationDraft(asset: SavedLocation): LocationDraft {
  return {
    locationText: asset.lastKnownLocationText || '',
    latitude: asset.lastKnownLat == null ? '' : String(asset.lastKnownLat),
    longitude: asset.lastKnownLng == null ? '' : String(asset.lastKnownLng),
  };
}

export function validLocationCoordinates(location: LocationDraft): boolean {
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  return location.latitude.trim() !== '' && location.longitude.trim() !== '' &&
    Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
    Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

function coordinateKey(value: string): string {
  const trimmed = value.trim();
  return trimmed && Number.isFinite(Number(trimmed)) ? String(Number(trimmed)) : trimmed;
}

export function hasLocationChanges(saved: LocationDraft, proposed: LocationDraft): boolean {
  return saved.locationText.trim() !== proposed.locationText.trim() ||
    coordinateKey(saved.latitude) !== coordinateKey(proposed.latitude) ||
    coordinateKey(saved.longitude) !== coordinateKey(proposed.longitude);
}
