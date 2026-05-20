-- Removes the live shared-register access layer.
-- Partner quote leads remain in asset_leads; partner notes remain in asset_partner_notes.

DROP TABLE IF EXISTS public.asset_register_access_grants;
