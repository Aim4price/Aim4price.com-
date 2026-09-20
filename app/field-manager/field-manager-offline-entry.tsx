'use client';
import AppOfflineEntry from '../../components/AppOfflineEntry';
export default function FieldManagerOfflineEntry() {
  return <AppOfflineEntry appRoot="/field-manager" worker="/field-manager-sw.js" />;
}
