
create table if not exists business_network (
 id uuid primary key, email text not null unique, name text not null,
 status text not null default 'invited' check(status in ('invited','active','paused')),
 details jsonb not null default '{}', invited_by text not null,
 accepted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists business_network_google_place on business_network ((details->>'googlePlaceId')) where status = 'active' and coalesce(details->>'googlePlaceId','') <> '';
create table if not exists business_network_tokens (
 hash text primary key, business_id uuid not null references business_network(id),
 expires_at timestamptz not null, created_at timestamptz not null default now()
);
create table if not exists business_network_requests (
 id uuid primary key, owner_id text not null, business_id uuid not null references business_network(id),
 request_key text not null, token_hash text not null unique, snapshot jsonb not null,
 status text not null default 'pending' check(status in ('pending','sent','failed')),
 expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz not null default now(),
 unique(owner_id, business_id, request_key)
);
create table if not exists business_network_rate_limits (
 key text primary key, count integer not null, started_at timestamptz not null default now()
);