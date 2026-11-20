type ReceivedAsset = {
  id: string;
  ownerUserId: string;
  partnerUserId: string;
  includedSections: Record<string, unknown>;
};

export function receivedUmbrella(lead: ReceivedAsset) {
  const share = lead.includedSections.assetGroupShare;
  if (!share || typeof share !== 'object' || !('batchId' in share) ||
      typeof share.batchId !== 'string' || !share.batchId.trim()) return null;
  return {
    key: JSON.stringify([lead.ownerUserId, lead.partnerUserId, share.batchId]),
    name: 'name' in share && typeof share.name === 'string' && share.name.trim() ? share.name : 'Asset umbrella',
    position: 'childIndex' in share && typeof share.childIndex === 'number' ? share.childIndex : Infinity,
  };
}

export function sharedAssetRows<T extends ReceivedAsset>(received: T[], matches: T[], groupShares: boolean) {
  type Row = { key: string; name: string | null; members: T[] };
  const rows: Row[] = [];
  const batches = new Map<string, Row>();
  if (groupShares) {
    for (const lead of received) {
      const umbrella = receivedUmbrella(lead);
      if (!umbrella) continue;
      let row = batches.get(umbrella.key);
      if (!row) {
        row = { key: umbrella.key, name: umbrella.name, members: [] };
        batches.set(row.key, row);
      }
      row.members.push(lead);
    }
  }
  const shown = new Set<string>();
  for (const lead of matches) {
    const umbrella = groupShares && receivedUmbrella(lead);
    const row = umbrella && batches.get(umbrella.key);
    if (!row) {
      rows.push({ key: lead.id, name: null, members: [lead] });
    } else if (!shown.has(row.key)) {
      shown.add(row.key);
      row.members.sort((a, b) => receivedUmbrella(a)!.position - receivedUmbrella(b)!.position);
      rows.push(row);
    }
  }
  return rows;
}
