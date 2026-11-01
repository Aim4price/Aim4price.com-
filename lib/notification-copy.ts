/** Correct known system-generated historical wording without changing event identity or read state. */
export function normalizeNotificationCopy<T extends {id: string; title: string; body: string}>(item: T): T {
  let {title, body} = item;
  if (item.id.startsWith('lead-owner:')) {
    const status = item.id.split(':')[2];
    const old = body.match(/^(.+?) (?:viewed|accepted|quoted|declined|closed) your (?:replacement quote|finance|insurance) request for (.+)\.$/);
    const shared = body.match(/^(.+?) (?:accepted|quoted|declined|closed) the shared asset (.+)\.$/);
    const parts = old || shared;
    if (parts) {
      const [, partner, asset] = parts;
      if (status === 'viewed' || status === 'accepted') {
        title = 'Asset received and opened';
        body = `${asset} has been received and opened by ${partner}.`;
      } else if (status === 'quoted' || status === 'closed') {
        const label = status === 'quoted' ? 'handled' : 'closed';
        title = `Shared asset ${label}`;
        body = `${partner} marked ${asset} as ${label}.`;
      } else if (status === 'declined') {
        title = 'Shared asset removed';
        body = `${partner} removed ${asset} from their shared assets. Your Asset Register is unchanged.`;
      }
    }
  }
  if (item.id.startsWith('lead-partner:')) {
    const old = body.match(/^(.+?) sent (?:an opportunity|a (?:replacement quote|finance|insurance) opportunity) for (.+?)\.( Message:[\s\S]*)?$/);
    if (old) {
      title = 'Asset shared with you';
      body = `${old[1]} has shared ${old[2]} with you.${old[3] || ''}`;
    }
  }
  if (item.id.startsWith('dealer-correction:')) {
    if (title === 'Dealer updated asset details') title = 'Asset detail changes proposed';
    if (title === 'Licence expert updated renewal date') title = 'Licence renewal date change proposed';
    body = body.replace(' updated the ', ' suggested changing the ')
      .replace('Accept the change to update your Asset Register.', 'Review and accept to update your Asset Register.');
  }
  if (item.id.startsWith('asset-discovery-requester:') && title === 'Asset unavailable for 90 days') {
    title = 'Owner is not selling currently';
  }
  if (item.id.startsWith('asset-discovery-owner:') && title === '#1 priority · Discovery enquiry') {
    title = 'Someone is interested in your asset';
  }
  if (item.id.startsWith('billing-invoice:') && title === 'New Aim4price.com invoice') {
    // Historical snapshots do not establish the current payment balance.
    title = 'Invoice issued';
  }
  if (item.id.startsWith('maintenance:') && title === 'Maintenance upcoming') {
    title = item.id.endsWith(':overdue') ? 'Maintenance overdue'
      : item.id.endsWith(':due') ? 'Maintenance due now' : 'Maintenance due soon';
  }
  if (item.id.startsWith('license-renewal:') && title === 'License renewal upcoming') {
    title = item.id.endsWith(':overdue') ? 'Licence renewal overdue'
      : item.id.endsWith(':due') ? 'Licence renewal due today' : 'Licence renewal due soon';
  }
  return {...item, title, body};
}
