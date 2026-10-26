'use client';
import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from './WebsitePortal';
import AssetPartsModal from './AssetPartsModal';

export default function AppAssetPartsButton({ endpoint, assetTitle, assetSubtitle, className, manageAction, children }: {
  endpoint: string; assetTitle: string; assetSubtitle?: string; className?: string; manageAction?: string; children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <><button ref={trigger} type="button" className={className} data-manage-action={manageAction} onClick={() => setOpen(true)}>{children || 'Parts'}</button>{open && createPortal(<AssetPartsModal key={endpoint} endpoint={endpoint} assetTitle={assetTitle} assetSubtitle={assetSubtitle} onClose={() => { setOpen(false); trigger.current?.focus(); }} />, document.body)}</>;
}
