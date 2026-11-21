-- Run once inside the startup transaction. Keep identities, client records and invoice history.
create table if not exists aim4price_business_conversion (
  version integer primary key, completed_at timestamptz not null default now()
);
do $convert$
begin
  if exists (select 1 from aim4price_business_conversion where version=1) then return; end if;
  if to_regclass('account_profiles') is null then return; end if;
  alter table account_profiles drop constraint if exists account_profiles_account_role_check;
  alter table account_profiles add constraint account_profiles_account_role_check
        check (
          (account_type = 'business' and account_subtype in ('contributor', 'finance-services', 'insurance-services', 'licensing-services', 'accounting-services', 'maintenance-services'))
          or (account_type = 'owner' and account_subtype in
            ('farmer', 'contractor', 'construction-company', 'asset-owner'))
          or (account_type = 'finance' and account_subtype in
            ('bank', 'finance-house', 'accountant'))
          or (account_type = 'insurance' and account_subtype = 'short-term-insurer')
          or (account_type = 'dealer' and account_subtype in
            ('machinery-dealer', 'motor-dealer', 'auctioneer', 'equipment-middleman', 'contributor', 'finance-services', 'insurance-services', 'licensing-services', 'accounting-services', 'maintenance-services'))
          or (account_type = 'licensing' and account_subtype in
            ('licence-renewal-expert', 'fleet-licensing-service'))
        ) not valid;
  alter table account_profiles validate constraint account_profiles_account_role_check;

  -- A request to upgrade, credits used, or a verified email never activates Desktop.
  if to_regclass('business_workspaces') is null then return; end if;
  create temporary table converting_business_accounts on commit drop as
    select p.user_id from account_profiles p
    join business_workspaces w on w.owner_user_id=p.user_id and (to_jsonb(w)->>'paid_since') is not null
    where p.account_type='business' and p.account_status='active'
      and p.user_id not like 'aim4price-assistance-%'
;
  if to_regclass('business_workspace_members') is not null then
    delete from converting_business_accounts c using business_workspace_members m
      where m.user_id=c.user_id and (m.status<>'active' or m.role<>'owner');
  end if;
  if to_regclass('guest_businesses') is not null then
    delete from converting_business_accounts c using "user" u, guest_businesses g
      where u.id=c.user_id and g.email=lower(u.email) and g.suspended;
    if to_regclass('business_verified_identities') is not null then
      delete from converting_business_accounts c using business_workspace_members m,
        business_verified_identities i, guest_businesses g
        where m.user_id=c.user_id and i.business_id=m.business_id and g.email=i.email and g.suspended;
    end if;
  end if;
  if to_regclass('business_verified_identities') is not null then
    delete from converting_business_accounts c using "user" u, business_verified_identities i
      where u.id=c.user_id and i.email=lower(u.email) and i.user_id<>u.id;
  end if;

  update account_profiles p set account_type='dealer',updated_at=now()
    from converting_business_accounts c where p.user_id=c.user_id;
  if to_regclass('sharing_account_access') is not null then
    insert into sharing_account_access(user_id,plan)
    select user_id,'desktop' from converting_business_accounts
    on conflict(user_id) do update set plan='desktop',updated_at=now();
  end if;
  insert into aim4price_business_conversion(version) values(1);
end
$convert$;
