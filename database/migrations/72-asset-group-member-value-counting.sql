-- Umbrellas are organisational groups by default. A primary asset is optional,
-- and every member controls independently whether its value contributes to totals.

ALTER TABLE IF EXISTS public.asset_group_members
  ADD COLUMN IF NOT EXISTS counts_toward_total boolean;

ALTER TABLE IF EXISTS public.asset_group_members
  DROP CONSTRAINT IF EXISTS asset_group_members_role_check;

ALTER TABLE IF EXISTS public.asset_group_members
  ADD CONSTRAINT asset_group_members_role_check
    CHECK (role IN ('primary', 'linked', 'member'));

ALTER TABLE IF EXISTS public.asset_group_members
  DROP CONSTRAINT IF EXISTS asset_group_members_relationship_check;

ALTER TABLE IF EXISTS public.asset_group_members
  ADD CONSTRAINT asset_group_members_relationship_check
    CHECK (relationship IN ('primary', 'grouped', 'works_with', 'located_at', 'component_of', 'attached_to', 'other'));

UPDATE public.asset_group_members member
SET counts_toward_total = CASE
      WHEN asset_group.value_mode = 'included_in_primary' THEN member.role = 'primary'
      ELSE true
    END,
    role = CASE
      WHEN asset_group.value_mode = 'included_in_primary' THEN member.role
      ELSE 'member'
    END,
    relationship = CASE
      WHEN asset_group.value_mode = 'included_in_primary' THEN member.relationship
      ELSE 'grouped'
    END
FROM public.asset_groups asset_group
WHERE asset_group.id = member.group_id
  AND member.counts_toward_total IS NULL;

ALTER TABLE IF EXISTS public.asset_group_members
  ALTER COLUMN role SET DEFAULT 'member',
  ALTER COLUMN relationship SET DEFAULT 'grouped',
  ALTER COLUMN counts_toward_total SET DEFAULT true,
  ALTER COLUMN counts_toward_total SET NOT NULL;

CREATE OR REPLACE FUNCTION public.unlink_asset_group_on_register_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF tg_op = 'DELETE' THEN
    DELETE FROM public.asset_group_members
    WHERE asset_id = old.id;
  ELSIF new.register_id IS DISTINCT FROM old.register_id THEN
    DELETE FROM public.asset_group_members member
    USING public.asset_groups asset_group
    WHERE member.asset_id = old.id
      AND asset_group.id = member.group_id
      AND asset_group.register_id IS NOT NULL;
  END IF;

  UPDATE public.asset_group_members member
  SET role = 'member', relationship = 'grouped'
  WHERE member.role = 'linked'
    AND NOT EXISTS (
      SELECT 1
      FROM public.asset_group_members primary_member
      WHERE primary_member.group_id = member.group_id
        AND primary_member.role = 'primary'
    );

  UPDATE public.asset_groups asset_group
  SET value_mode = CASE
        WHEN EXISTS (
          SELECT 1 FROM public.asset_group_members member
          WHERE member.group_id = asset_group.id AND member.role = 'primary'
        ) AND NOT EXISTS (
          SELECT 1 FROM public.asset_group_members member
          WHERE member.group_id = asset_group.id
            AND member.role <> 'primary'
            AND member.counts_toward_total
        ) THEN 'included_in_primary'
        ELSE 'separate'
      END;

  DELETE FROM public.asset_groups asset_group
  WHERE (
      SELECT count(*)
      FROM public.asset_group_members member
      WHERE member.group_id = asset_group.id
    ) < 1;

  IF tg_op = 'DELETE' THEN
    RETURN old;
  END IF;

  RETURN new;
END
$$;
