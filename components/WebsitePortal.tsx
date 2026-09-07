'use client';

import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import { createPortal as reactCreatePortal } from 'react-dom';
import { websiteOverlayRoot } from '../lib/website-canvas';

export const WebsiteCanvasContext = createContext(false);

function PortalHost({ children, target, portalKey }: {
  children: ReactNode;
  target: Element | DocumentFragment;
  portalKey?: string | null;
}) {
  const isWebsite = useContext(WebsiteCanvasContext);
  const usesWebsiteRoot = isWebsite && target === document.body;
  const [host, setHost] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    setHost(usesWebsiteRoot ? websiteOverlayRoot() : null);
  }, [usesWebsiteRoot]);

  if (!usesWebsiteRoot) return reactCreatePortal(children, target, portalKey);
  // Resolve after commit so an initially open overlay cannot race the canvas
  // host's first mount and accidentally remain attached to document.body.
  return host ? reactCreatePortal(children, host, portalKey) : null;
}

/** Preserve explicit in-page hosts and native app portals; centralize website body portals. */
export function createPortal(children: ReactNode, target: Element | DocumentFragment, key?: string | null) {
  return <PortalHost key={key} target={target} portalKey={key}>{children}</PortalHost>;
}
