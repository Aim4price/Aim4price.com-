/** Shared by native route guards and cards. Never grants desktop/owner powers. */
export function managerAssetSectionAllowed(section: string, owner: boolean, can: (key: string) => boolean): boolean {
  if (owner) return true;
  switch (section) {
    case 'usage': return can('updateUsage');
    case 'details': return can('editDetails');
    case 'media': return can('viewPhotos') || can('uploadPhotos') || can('uploadDocuments');
    case 'location': return can('updateLocation');
    case 'maintenance': return can('viewMaintenance');
    case 'reports': return can('exportAssets');
    default: return false;
  }
}
