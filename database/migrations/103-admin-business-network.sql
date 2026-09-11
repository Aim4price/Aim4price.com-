-- Records direct Admin publishing separately from a business accepting an invitation.
create table if not exists business_network_admin_actions (
 id uuid primary key, business_id uuid not null references business_network(id),
 admin_id text not null, action text not null, created_at timestamptz not null default now()
);
