-- Billing-linked suspension context. Account status remains the access authority.
alter table account_profiles
 add column if not exists suspension_reason text,
 add column if not exists billing_suspension_invoice_id uuid;
