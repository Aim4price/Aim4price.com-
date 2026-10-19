'use client';

import { useEffect } from 'react';
import { installScrollbarInteractionGuard } from '../lib/scrollbar-interaction';

export default function ScrollbarInteractionGuard() {
  useEffect(installScrollbarInteractionGuard, []);
  return null;
}
