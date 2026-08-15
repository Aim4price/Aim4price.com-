'use client';

import { DealerAppAccessManagement } from '../app-access-management-client';

export default function DealerAccessClient({ middlemanMode = false }: { middlemanMode?: boolean }) {
  return <DealerAppAccessManagement middlemanMode={middlemanMode} />;
}
