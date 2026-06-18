-- Aim4price migration 33
-- WARNING: This permanently removes the retired external market-evidence table.
-- It does not remove public.marketplace_listings, user-owned Aim4price Marketplace listings,
-- Asset Register data, valuation runs, listing photos, seller contact details or asking prices.

BEGIN;

DROP TABLE IF EXISTS public.market_vault_listings CASCADE;

COMMIT;
