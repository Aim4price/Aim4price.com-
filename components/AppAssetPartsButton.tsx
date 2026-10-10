'use client';
import { useState, type ReactNode } from 'react';
import { createPortal } from './WebsitePortal';
import AssetPartsModal from './AssetPartsModal';

export default function AppAssetPartsButton({ endpoint, assetTitle, assetSubtitle, className, children }: {
  endpoint: string; assetTitle: string; assetSubtitle?: string; className?: string; children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className={className} onClick={() => setOpen(true)}>{children || 'Parts'}</button>{open && createPortal(<AssetPartsModal key={endpoint} endpoint={endpoint} assetTitle={assetTitle} assetSubtitle={assetSubtitle} onClose={() => setOpen(false)} />, document.body)}</>;
}
