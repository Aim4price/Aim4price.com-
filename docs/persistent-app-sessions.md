# Persistent app sign-in

Owner, Field/Management, Dealer and Middleman app logins now issue signed persistent sessions. The application no longer expires these sessions after 12 hours or 30 days. Every authenticated request still validates the live user, account and session version. Dealer/Middleman role and realm checks remain in place. Field/Management now also verifies that the parent account is an active owner account.

Each app renews its HttpOnly cookie on mount, on returning to the app or reconnecting (throttled to five minutes), and every six hours while visible. Renewal requires a trusted origin and a valid, non-revoked session. Transient renewal failures do not clear credentials or redirect. Field renewal preserves the session ID used by work records. Temporary asset/fuel scan permissions still expire after 45 minutes.

Existing unexpired sessions upgrade on successful renewal. Expired legacy sessions are not revived; those users must sign in once. Logout clears the app cookie; disabling/deleting users, changing their session version or suspending the parent account blocks future authenticated requests. The website and admin support session policies are unchanged.

Browser storage is not permanent: cookies request 400 days of retention, renewed by app use. Clearing app/site data, private browsing, browser eviction or exceeding the browser cookie retention window can still require signing in again. No password or session token is stored in localStorage.

Validation: TypeScript checking and runtime tests covering time advancement, legacy expiry, signature tampering, revocation, account suspension, app isolation, renewal-origin checks and offline renewal failures. Real-device browser retention and production database behaviour require deployment validation.
