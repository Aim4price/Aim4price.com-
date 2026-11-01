-- Activate ready desktop logins without a separate invitation acceptance step.
-- Preserve inactive/expired access and never rebind a membership to another identity.
UPDATE team_access t SET status='active',member_user_id=u.id,version=t.version+1,updated_at=now()
FROM "user" u
WHERE t.status='pending' AND NOT t.managed_login AND lower(u.email)=t.email
 AND (t.member_user_id=u.id OR (t.member_user_id IS NULL AND u.id=(SELECT min(u2.id) FROM "user" u2 WHERE lower(u2.email)=t.email)))
 AND (t.expires_at IS NULL OR t.expires_at>now());
UPDATE team_access t SET status='active',version=t.version+1,updated_at=now()
WHERE t.status='pending' AND t.managed_login
 AND EXISTS (SELECT 1 FROM team_access_logins l WHERE l.grant_id=t.id)
 AND (t.expires_at IS NULL OR t.expires_at>now());
