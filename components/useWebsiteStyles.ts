'use client';

import { useContext } from 'react';
import { WebsiteCanvasContext } from './WebsitePortal';

/** Reused app controls keep their native classes outside the website canvas. */
export function useWebsiteStyles<T extends Record<string, string>>(native: T, website: T): T {
  return useContext(WebsiteCanvasContext) ? website : native;
}
