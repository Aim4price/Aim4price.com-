# Business accounts and guest leads

See [Business accounts and external sharing](../BUSINESS-DIRECTORY.md) for the current setup.

## What the recipient sees

- Without signing in: asset card, request, included photos and owner-enabled reply options.
- **Manage → Sign up / sign in with email**: limited guest registration using an emailed six-digit code. No full Aim4price workspace is created.
- After verification: reports remain locked until guest access is active.
- With matching verified email and active guest access: selected reports open. An eligible active full Aim4price account with that verified email also has access.
- Wrong email, suspended/expired access, disabled link or removed ownership: report access is refused on the server, even if the download URL is known.

The receiving business pays. There is no automated checkout in this release.

## Activate paid access manually

1. Have the business confirm its email on its lead page.
2. Open Admin → Sharing & access and refresh **Guest report access**.
3. After receiving payment, choose the expiry date, enter a payment reference/note and select **Activate paid access**.
4. Ask the business to select **Check access again** on its lead page.
5. **Suspend access** blocks subsequent report downloads immediately. Access also ends at the selected expiry (end of that date in UTC).

Activation applies to reports shared with that business email; it does not open other recipients' leads. All changes are audited with the admin identity, expiry and note.

