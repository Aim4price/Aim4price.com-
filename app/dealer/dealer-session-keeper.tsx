'use client';

import AppSessionKeeper from '../app-session-keeper';
import { useDealerAppRoot } from '../../lib/use-dealer-app-root';

export default function DealerSessionKeeper() {
  return <AppSessionKeeper appRoot={useDealerAppRoot()} />;
}
