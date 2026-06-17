# Aim4price auth/admin patch notes

## Changed/new files

- `app/page.tsx`
- `app/auth/page.tsx`
- `app/auth/auth-client.tsx`
- `app/reset-password/page.tsx`
- `app/valuation/page.tsx`
- `app/marketplace/page.tsx`
- `app/scan/[publicAssetCode]/page.tsx`
- `app/fuel-scan/[publicFuelStorageCode]/page.tsx`
- `app/admin/page.tsx`
- `app/admin/admin-client.tsx`
- `app/admin/page.module.css`
- `app/privacy-policy/page.tsx`
- `app/terms-of-service/page.tsx`
- `lib/auth.ts`
- `lib/auth-session.ts`
- `lib/account-access.ts`
- `lib/account-profile.ts`
- `lib/email.ts`
- `database/schema.sql`
- `database/migrations/30-admin-only-access-hardening.sql`
- `AUTH-ADMIN-PATCH-NOTES.md`

## Railway environment variables

Set or confirm these in the Railway app service:

```env
BETTER_AUTH_URL=https://aim4price.com
NEXT_PUBLIC_SITE_URL=https://aim4price.com
BETTER_AUTH_TRUSTED_ORIGINS=https://aim4price.com,https://www.aim4price.com
BETTER_AUTH_SECRET=<existing secret>
RESEND_API_KEY=<resend key>
AIM4PRICE_RESET_EMAIL_FROM=Aim4price <reset@aim4price.com>
AIM4PRICE_RESET_EMAIL_REPLY_TO=aim4price@gmail.com
```

Keep the existing PostgreSQL variables (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` or `DATABASE_URL`) unchanged if they are already working.

## SQL migration to run in DBeaver

Run:

```sql
-- database/migrations/30-admin-only-access-hardening.sql
```

That migration:

- keeps `aim4price@gmail.com` active;
- backfills missing profiles for existing Better Auth users;
- defaults new/missing normal account statuses to `pending_payment`;
- adds/repairs status and introduced-by constraints;
- does not expose or store plain-text passwords.

Optional only if you intentionally want all existing non-admin accounts to require manual approval again:

```sql
update public.account_profiles ap
set account_status = 'pending_payment', updated_at = now()
from public."user" u
where ap.user_id = u.id
  and lower(trim(coalesce(u.email, ''))) <> 'aim4price@gmail.com';
```

## Test steps after deployment

1. Open `/` while logged out. The homepage should load.
2. Open `/auth#signup`; create a normal user and complete the required `Introduced by` field.
3. After signup, try `/asset-register`; the pending user should be sent to `/pending-payment`.
4. Log in as `aim4price@gmail.com`; the app should go to `/admin`.
5. While logged in as `aim4price@gmail.com`, manually open `/`, `/valuation`, `/asset-register`, `/marketplace`, `/account`, `/scan/test`, and `/fuel-scan/test`; each should redirect to `/admin` or be blocked server-side.
6. On `/admin`, activate the pending normal user.
7. Log out of admin, log in as the normal user, and confirm `/asset-register` loads.
8. On `/auth#forgot`, request a reset email and confirm the email link points to `https://aim4price.com/reset-password?token=...`.
9. Open `/reset-password?token=test`; the page should load. Submit should fail because `test` is not a real token, but the route must not 404.
10. Use a real reset email token and confirm the password reset succeeds.
11. As an active normal user, open `/account` and confirm password change works.
12. Back in `/admin`, test `Send reset email`, `Set pending`, `Suspend`, and `Activate account` on a non-admin user.
