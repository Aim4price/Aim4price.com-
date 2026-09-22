import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { ensureBusinessNetwork } from "./business-network";
import {
  businessEmail,
  businessText,
  validateBusinessDetails,
  type BusinessDetails,
} from "./business-network-shared";

export type AdminBusiness = {
  id: string;
  name: string;
  email: string;
  status: string;
  details: Partial<BusinessDetails>;
};
export const ADMIN_BUSINESS_SCHEMA = `create table if not exists business_network_admin_actions (
 id uuid primary key, business_id uuid not null references business_network(id),
 admin_id text not null, action text not null, created_at timestamptz not null default now()
);`;
async function ensure() {
  await ensureBusinessNetwork();
  await getDb().query(ADMIN_BUSINESS_SCHEMA);
}
export async function listAdminBusinesses() {
  await ensure();
  return (
    await getDb().query<AdminBusiness>(
      "select id,name,email,case when status='active' and accepted_at is null then 'invited' else status end as status,details from business_network order by name,id",
    )
  ).rows;
}
export async function saveAdminBusiness(
  adminId: string,
  input: Record<string, unknown>,
) {
  await ensure();
  const id = businessText(input.id);
  if (
    id &&
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
  )
    throw new Error("This business could not be found.");
  const existing = id
    ? (
        await getDb().query<AdminBusiness>(
          "select id,name,email,status,details from business_network where id=$1",
          [id],
        )
      ).rows[0]
    : null;
  if (id && !existing) throw new Error("This business could not be found.");
  if (input.action === "pause") {
    if (!existing) throw new Error("Choose an existing business.");
    await getDb().query(
      `with updated as (
      update business_network set status='paused',updated_at=now() where id=$1 returning id
    ), revoked as (
      update business_network_requests set revoked_at=now() where business_id in (select id from updated) and revoked_at is null
    ) insert into business_network_admin_actions(id,business_id,admin_id,action) select $2,id,$3,'pause' from updated`,
      [id, randomUUID(), adminId],
    );
    return id;
  }
  if (input.action === "publish") {
    if (!existing) throw new Error("Choose an existing business.");
    validateBusinessDetails({ ...existing.details, name: existing.name }, existing.email);
    await getDb().query(`with published as (
      update business_network set status='active',accepted_at=coalesce(accepted_at,now()),updated_at=now() where id=$1 returning id
    ) insert into business_network_admin_actions(id,business_id,admin_id,action) select $2,id,$3,'manually_approve_publish' from published`, [id, randomUUID(), adminId]);
    return id;
  }
  // Existing delivery addresses stay fixed; editing a listing must not redirect its enquiries.
  const email = existing?.email || businessEmail(input.email);
  if (
    existing &&
    input.email !== undefined &&
    businessEmail(input.email) !== email
  )
    throw new Error("This business email cannot be changed here.");
  const details = validateBusinessDetails(input, email);
  const businessId = id || randomUUID();
  const publish = input.action === "save_publish";
  try {
    if (existing) {
      await getDb().query(
        `with updated as (
        update business_network set name=$2,details=$3,
          status=case when $6 then 'active' else status end,
          accepted_at=case when $6 then coalesce(accepted_at,now()) else accepted_at end,
          updated_at=now() where id=$1 returning id
      ) insert into business_network_admin_actions(id,business_id,admin_id,action) select $4,id,$5,case when $6 then 'update_and_publish' else 'update' end from updated`,
        [
          businessId,
          details.name,
          JSON.stringify(details),
          randomUUID(),
          adminId,
          publish,
        ],
      );
    } else {
      await getDb().query(
        `with added as (
        insert into business_network(id,email,name,status,details,invited_by,accepted_at)
        values($1,$2,$3,case when $7 then 'active' else 'invited' end,$4,$5,case when $7 then now() else null end) returning id
      ) insert into business_network_admin_actions(id,business_id,admin_id,action) select $6,id,$5,case when $7 then 'create_and_publish' else 'create' end from added`,
        [
          businessId,
          email,
          details.name,
          JSON.stringify(details),
          adminId,
          randomUUID(),
          publish,
        ],
      );
    }
  } catch (e) {
    if ((e as { code?: string }).code === "23505")
      throw new Error(
        "This email or Google business is already listed. Open the existing listing to edit it.",
      );
    throw e;
  }
  return businessId;
}
