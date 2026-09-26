-- Free contributors retain the existing login identity and have separate manual verification.

    do $migration$
    declare
      role_constraint record;
    begin
      perform pg_advisory_xact_lock(
        hashtext('aim4price:account-profiles:licensing-role')
      );

      if exists (
        select 1
        from pg_constraint
        where conrelid = 'public.account_profiles'::regclass
          and contype = 'c'
          and conname = 'account_profiles_account_role_check'
          and pg_get_constraintdef(oid) ilike '%licensing%'
          and pg_get_constraintdef(oid) ilike '%licence-renewal-expert%'
          and pg_get_constraintdef(oid) ilike '%contributor%'
      )
      and not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.account_profiles'::regclass
          and contype = 'c'
          and conname <> 'account_profiles_account_role_check'
          and (
            pg_get_constraintdef(oid) ilike '%account_type%'
            or pg_get_constraintdef(oid) ilike '%account_subtype%'
          )
      )
      and not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'account_profiles'
          and column_name in ('account_type', 'account_subtype')
          and (
            data_type <> 'text'
            or is_nullable = 'YES'
            or column_default is null
          )
      )
      and 2 = (
        select count(*)
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'account_profiles'
          and column_name in ('account_type', 'account_subtype')
      ) then
        return;
      end if;

      for role_constraint in
        select conname
        from pg_constraint
        where conrelid = 'public.account_profiles'::regclass
          and contype = 'c'
          and (
            pg_get_constraintdef(oid) ilike '%account_type%'
            or pg_get_constraintdef(oid) ilike '%account_subtype%'
          )
      loop
        execute format(
          'alter table public.account_profiles drop constraint %I',
          role_constraint.conname
        );
      end loop;

      alter table public.account_profiles
        alter column account_type drop default,
        alter column account_subtype drop default;

      alter table public.account_profiles
        alter column account_type type text using account_type::text,
        alter column account_subtype type text using account_subtype::text;

      update public.account_profiles
      set account_type = case lower(regexp_replace(trim(coalesce(account_type, '')), '[ _]+', '-', 'g'))
        when 'bank' then 'finance'
        when 'finance-house' then 'finance'
        when 'accountant' then 'finance'
        when 'accounting' then 'finance'
        when 'finance' then 'finance'
        when 'broker' then 'insurance'
        when 'insurer' then 'insurance'
        when 'short-term-insurer' then 'insurance'
        when 'insurance' then 'insurance'
        when 'auction-house' then 'dealer'
        when 'auctioneer' then 'dealer'
        when 'middleman' then 'dealer'
        when 'machinery-middleman' then 'dealer'
        when 'equipment-middleman' then 'dealer'
        when 'machinery-dealer' then 'dealer'
        when 'motor-dealer' then 'dealer'
        when 'dealer' then 'dealer'
        when 'license-renewal' then 'licensing'
        when 'licence-renewal' then 'licensing'
        when 'licensing-expert' then 'licensing'
        when 'license-renewal-expert' then 'licensing'
        when 'licence-renewal-expert' then 'licensing'
        when 'licensing' then 'licensing'
        when 'business' then 'business'
        when 'owner' then 'owner'
        else 'owner'
      end;

      update public.account_profiles
      set account_subtype = case account_type
        when 'business' then 'contributor'
        when 'owner' then case
          when lower(regexp_replace(trim(coalesce(account_subtype, '')), '[ _]+', '-', 'g')) in
            ('farmer', 'contractor', 'construction-company', 'asset-owner')
            then lower(regexp_replace(trim(account_subtype), '[ _]+', '-', 'g'))
          else 'farmer'
        end
        when 'finance' then case
          when lower(regexp_replace(trim(coalesce(account_subtype, '')), '[ _]+', '-', 'g')) in
            ('bank', 'finance-house', 'accountant')
            then lower(regexp_replace(trim(account_subtype), '[ _]+', '-', 'g'))
          else 'bank'
        end
        when 'insurance' then 'short-term-insurer'
        when 'dealer' then case
          when lower(regexp_replace(trim(coalesce(account_subtype, '')), '[ _]+', '-', 'g')) in
            ('machinery-dealer', 'motor-dealer')
            then lower(regexp_replace(trim(account_subtype), '[ _]+', '-', 'g'))
          when lower(regexp_replace(trim(coalesce(account_subtype, '')), '[ _]+', '-', 'g')) in
            ('auction-house', 'auctioneer')
            then 'auctioneer'
          when lower(regexp_replace(trim(coalesce(account_subtype, '')), '[ _]+', '-', 'g')) in
            ('middleman', 'machinery-middleman', 'equipment-middleman')
            then 'equipment-middleman'
          else 'machinery-dealer'
        end
        when 'licensing' then case
          when lower(regexp_replace(trim(coalesce(account_subtype, '')), '[ _]+', '-', 'g')) =
            'fleet-licensing-service'
            then 'fleet-licensing-service'
          else 'licence-renewal-expert'
        end
      end;

      alter table public.account_profiles
        alter column account_type set default 'owner',
        alter column account_type set not null,
        alter column account_subtype set default 'farmer',
        alter column account_subtype set not null;

      alter table public.account_profiles
        add constraint account_profiles_account_role_check
        check (
          (account_type = 'business' and account_subtype = 'contributor')
          or (account_type = 'owner' and account_subtype in
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


CREATE TABLE IF NOT EXISTS business_account_reviews (
 user_id text PRIMARY KEY REFERENCES account_profiles(user_id) ON DELETE CASCADE,
 website text NOT NULL DEFAULT '', evidence text NOT NULL DEFAULT '',
 verified_at timestamptz, verified_by text, verified_email text, review_note text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS business_account_review_events (
 id bigserial PRIMARY KEY, user_id text NOT NULL REFERENCES account_profiles(user_id) ON DELETE CASCADE,
 actor_id text NOT NULL, action text NOT NULL, note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
