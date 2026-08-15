do $migration$
declare
  role_constraint record;
begin
  if to_regclass('public.account_profiles') is null then
    return;
  end if;

  for role_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.account_profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%account_type%'
      and pg_get_constraintdef(oid) ilike '%account_subtype%'
  loop
    execute format('alter table public.account_profiles drop constraint if exists %I', role_constraint.conname);
  end loop;

  update public.account_profiles
  set account_type = 'dealer',
      account_subtype = 'equipment-middleman'
  where lower(regexp_replace(trim(coalesce(account_type, '')), '[ _]+', '-', 'g')) in
      ('middleman', 'machinery-middleman', 'equipment-middleman')
     or lower(regexp_replace(trim(coalesce(account_subtype, '')), '[ _]+', '-', 'g')) in
      ('middleman', 'machinery-middleman', 'equipment-middleman');

  alter table public.account_profiles
    add constraint account_profiles_account_role_check
    check (
      (account_type = 'owner' and account_subtype in
        ('farmer', 'contractor', 'construction-company', 'asset-owner'))
      or (account_type = 'finance' and account_subtype in
        ('bank', 'finance-house', 'accountant'))
      or (account_type = 'insurance' and account_subtype = 'short-term-insurer')
      or (account_type = 'dealer' and account_subtype in
        ('machinery-dealer', 'motor-dealer', 'auctioneer', 'equipment-middleman'))
      or (account_type = 'licensing' and account_subtype in
        ('licence-renewal-expert', 'fleet-licensing-service'))
    ) not valid;

  alter table public.account_profiles
    validate constraint account_profiles_account_role_check;
end
$migration$;
