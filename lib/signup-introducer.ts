import { getDb } from './db';

export async function signupIntroducer(invite: unknown, returnTo: string | null) {
  const name = "coalesce(nullif(trim(p.business_name), ''), nullif(trim(u.name), ''))";
  if (typeof invite === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(invite)) {
    const result = await getDb().query(`select ${name} as name from business_workspaces w
      join account_profiles p on p.user_id=w.owner_user_id join "user" u on u.id=p.user_id
      where w.owner_invite_id=$1 and p.account_status='active' and p.account_type in ('business','dealer')`, [invite]);
    if (result.rows[0]?.name) return String(result.rows[0].name);
  }
  const partsToken = returnTo?.match(/^\/parts-share\/([0-9a-f]{64})$/)?.[1];
  if (partsToken) {
    const result = await getDb().query(`select m.business_name as name from parts_share_links s
      join parts_networks n on n.id=s.network_id
      join parts_network_members m on m.network_id=n.id and m.dealer_id=n.created_by
      where s.token=$1 and s.revoked_at is null and not n.archived and m.visible and m.status='active'`, [partsToken]);
    return result.rows[0]?.name ? String(result.rows[0].name) : null;
  }
  const token = returnTo?.match(/^\/asset-share\/([A-Za-z0-9_-]{43})(?:\?|$)/)?.[1];
  if (!token) return null;
  const result = await getDb().query(`select ${name} as name from asset_share_links s
    join "user" u on u.id=s.user_id left join account_profiles p on p.user_id=u.id
    where s.token=$1 and s.revoked_at is null`, [token]);
  return result.rows[0]?.name ? String(result.rows[0].name) : null;
}
