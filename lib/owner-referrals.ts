import { creditTransaction } from './business-credits';

// Install the insert hook only for sites with an actual referred signup.
export async function registerOwnerReferral(ownerId:string, invite:string) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(invite)) return;
  await creditTransaction(async db=>{
    const attached=await db.query(`insert into business_owner_referrals(owner_id,business_id,credits)
      select $1,w.id,w.referral_reward from business_workspaces w join account_profiles p on p.user_id=w.owner_user_id
      where w.owner_invite_id=$2 and w.owner_user_id<>$1 and p.account_type in ('business','dealer')
      and p.account_status='active' on conflict do nothing returning owner_id`,[ownerId,invite]);
    if(!attached.rowCount)return;
    await db.query("select pg_advisory_xact_lock(hashtext('owner-referral-triggers'))");
    if ((await db.query("select 1 from pg_trigger where tgname='a4p_referral_first_asset' and tgrelid=to_regclass('asset_register_items')")).rowCount) return;
    await db.query(`
      create or replace function a4p_referral_asset_added() returns trigger language plpgsql as $$
        begin
          if not exists(select 1 from business_owner_referrals where owner_id=new.user_id and rewarded_at is null) then return new; end if;
          perform id from "user" where id=new.user_id for update;
          update business_owner_referrals r set first_asset_at=coalesce(first_asset_at,now()),
            rewarded_at=case when u."emailVerified" then now() end
          from "user" u where r.owner_id=new.user_id and u.id=r.owner_id and r.rewarded_at is null;
          return new;
        end $$;
      create trigger a4p_referral_first_asset after insert on asset_register_items for each row execute function a4p_referral_asset_added();
      create or replace function a4p_referral_verified() returns trigger language plpgsql as $$
        begin
          update business_owner_referrals set rewarded_at=now() where owner_id=new.id and first_asset_at is not null and rewarded_at is null;
          return new;
        end $$;
      create trigger a4p_referral_email after update of "emailVerified" on "user" for each row
        when (new."emailVerified" and not old."emailVerified") execute function a4p_referral_verified();
    `);
  });
}
