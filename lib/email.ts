type SendAim4priceEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

const AIM4PRICE_EMAIL_FONT_STACK =
  'Montserrat, Arial, Helvetica, sans-serif';
const AIM4PRICE_EMAIL_LOGO_PATH = "/brand/aim4price-mark-white.png";
const AIM4PRICE_POSITIONING_TEXT =
  "Aim4price helps machinery owners, financiers, insurers and dealers make confident decisions with estimates, saved asset records and marketplace tools built for South Africa.";

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function getSiteOrigin(): string {
  const explicit =
    readEnv("BETTER_AUTH_URL") ||
    readEnv("NEXT_PUBLIC_SITE_URL") ||
    readEnv("RAILWAY_PUBLIC_DOMAIN") ||
    readEnv("VERCEL_URL");

  if (!explicit) {
    return process.env.NODE_ENV === "production"
      ? "https://aim4price.com"
      : "http://localhost:3000";
  }

  const withProtocol = /^https?:\/\//i.test(explicit)
    ? explicit
    : `https://${explicit}`;

  try {
    const parsed = new URL(withProtocol);
    return parsed.origin;
  } catch {
    return process.env.NODE_ENV === "production"
      ? "https://aim4price.com"
      : "http://localhost:3000";
  }
}

function getPublicAssetUrl(path: string): string {
  return new URL(path, getSiteOrigin()).toString();
}

export function getResetPasswordRedirectUrl(): string {
  return `${getSiteOrigin()}/reset-password`;
}

export function buildAim4priceResetPasswordUrl(
  token: string | null | undefined,
  fallbackUrl?: string,
): string {
  const cleanedToken = typeof token === "string" ? token.trim() : "";

  if (!cleanedToken) {
    return fallbackUrl || getResetPasswordRedirectUrl();
  }

  const resetUrl = new URL(getResetPasswordRedirectUrl());
  resetUrl.searchParams.set("token", cleanedToken);
  return resetUrl.toString();
}

function getEmailFromAddress(): string {
  return (
    readEnv("AIM4PRICE_RESET_EMAIL_FROM") ||
    readEnv("AIM4PRICE_EMAIL_FROM") ||
    "Aim4price <reset@aim4price.com>"
  );
}

function getEmailReplyTo(): string {
  return (
    readEnv("AIM4PRICE_RESET_EMAIL_REPLY_TO") ||
    readEnv("AIM4PRICE_EMAIL_REPLY_TO") ||
    "aim4price@gmail.com"
  );
}

export async function sendAim4priceEmail(
  input: SendAim4priceEmailInput,
): Promise<void> {
  const apiKey = readEnv("RESEND_API_KEY");

  if (!apiKey) {
    const message = "RESEND_API_KEY is not set. Aim4price email was not sent.";

    if (process.env.NODE_ENV === "production") {
      throw new Error(message);
    }

    console.warn(message, {
      to: input.to,
      subject: input.subject,
    });
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getEmailFromAddress(),
      to: [input.to],
      reply_to: input.replyTo || getEmailReplyTo(),
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Resend email failed with status ${response.status}${errorText ? `: ${errorText}` : ""}`,
    );
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeTextValue(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") || "";
}

export async function sendAim4priceResetPasswordEmail(input: {
  to: string;
  name?: string | null;
  resetUrl: string;
}): Promise<void> {
  const displayName = normalizeTextValue(input.name) || "there";
  const safeName = escapeHtml(displayName);
  const safeUrl = escapeHtml(input.resetUrl);
  const logoUrl = escapeHtml(getPublicAssetUrl(AIM4PRICE_EMAIL_LOGO_PATH));
  const subject = "Reset your Aim4price password";
  const text = [
    `Hi ${displayName},`,
    "",
    "We received a request to reset your Aim4price password. Use the secure link below to create a new password for your account.",
    "",
    "Set new password:",
    input.resetUrl,
    "",
    "If you did not request this reset, you can safely ignore this email. Your current password will remain unchanged.",
    "",
    "This is an automated security email from Aim4price. Please do not share this reset link with anyone.",
    "",
    AIM4PRICE_POSITIONING_TEXT,
    "",
    "Aim4price",
  ].join("\n");

  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="x-apple-disable-message-reformatting" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <title>Reset your Aim4price password</title>
        <style>
          @media only screen and (max-width: 620px) {
            .email-shell { padding: 22px 12px 26px !important; }
            .email-card { border-radius: 22px !important; }
            .email-header { padding: 30px 24px 34px !important; border-radius: 22px 22px 0 0 !important; }
            .email-body { padding: 34px 24px 36px !important; border-radius: 0 0 22px 22px !important; }
            .email-title { font-size: 31px !important; line-height: 1.12 !important; }
            .email-copy { font-size: 15px !important; }
            .email-button a { display: block !important; text-align: center !important; }
            .email-icon-cell { display: none !important; }
          }
        </style>
      </head>
      <body style="margin:0;padding:0;background:#f3f3f0;color:#151515;font-family:${AIM4PRICE_EMAIL_FONT_STACK};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
        <div style="display:none;max-height:0;max-width:0;opacity:0;overflow:hidden;font-size:1px;line-height:1px;color:#f3f3f0;mso-hide:all;">
          Use the secure Aim4price link to set a new password for your account.
        </div>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0;padding:0;background:#f3f3f0;border-collapse:collapse;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
          <tr>
            <td align="center" class="email-shell" style="padding:44px 16px 38px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:680px;margin:0 auto;border-collapse:collapse;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                <tr>
                  <td style="padding:0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-card" style="width:100%;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #d8d8d3;border-radius:30px;box-shadow:0 24px 70px rgba(17,17,17,0.12);overflow:hidden;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                      <tr>
                        <td class="email-header" style="padding:44px 54px 50px;background:#111214;background-image:linear-gradient(135deg,#1b1c1f 0%,#111214 52%,#080809 100%);border-radius:30px 30px 0 0;color:#ffffff;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                            <tr>
                              <td align="left" style="padding:0 0 42px;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                                  <tr>
                                    <td valign="middle" style="padding:0 13px 0 0;line-height:0;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                                      <img src="${logoUrl}" width="54" height="42" alt="Aim4price" style="display:block;width:54px;height:auto;border:0;outline:none;text-decoration:none;" />
                                    </td>
                                    <td valign="middle" style="padding:0;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                                      <div style="margin:0;font-size:23px;line-height:1;font-weight:900;letter-spacing:-0.5px;text-transform:uppercase;color:#ffffff;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">AIM4PRICE</div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>

                          <div style="margin:0 0 15px;font-size:12px;line-height:1.3;font-weight:800;letter-spacing:5px;text-transform:uppercase;color:#bcbec2;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">Password reset</div>
                          <h1 class="email-title" style="margin:0 0 16px;font-size:42px;line-height:1.08;font-weight:900;letter-spacing:-1.4px;color:#ffffff;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">Reset your password</h1>
                          <p class="email-copy" style="margin:0;max-width:510px;font-size:17px;line-height:1.72;font-weight:500;color:#f0f0f0;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">A secure link was requested for your Aim4price account. Use it only if you started this password reset.</p>
                        </td>
                      </tr>

                      <tr>
                        <td class="email-body" style="padding:46px 54px 46px;background:#ffffff;border-radius:0 0 30px 30px;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                          <p style="margin:0 0 22px;font-size:24px;line-height:1.35;font-weight:900;letter-spacing:-0.4px;color:#171717;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">Hi ${safeName},</p>

                          <p style="margin:0;max-width:535px;font-size:17px;line-height:1.82;font-weight:500;color:#4f5258;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">We received a request to reset your Aim4price password. Use the button below to create a new password for your account.</p>

                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="email-button" style="border-collapse:collapse;margin:34px 0 36px;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                            <tr>
                              <td align="center" bgcolor="#111214" style="border-radius:10px;background:#111214;box-shadow:0 12px 22px rgba(17,18,20,0.22);">
                                <a href="${safeUrl}" style="display:inline-block;padding:18px 28px;border-radius:10px;background:#111214;color:#ffffff;font-size:16px;line-height:1.2;font-weight:900;letter-spacing:-0.1px;text-decoration:none;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">Set new password&nbsp;&nbsp;&rarr;</a>
                              </td>
                            </tr>
                          </table>

                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0;margin:0 0 30px;background:#ffffff;border:1px solid #d9dce1;border-radius:16px;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                            <tr>
                              <td style="padding:28px 28px 28px;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                                  <tr>
                                    <td valign="top" width="54" class="email-icon-cell" style="width:54px;padding:0 20px 0 0;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                                      <table role="presentation" width="54" height="54" cellspacing="0" cellpadding="0" border="0" style="width:54px;height:54px;border-collapse:separate;border-spacing:0;background:#f0f1f3;border-radius:50%;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                                        <tr>
                                          <td align="center" valign="middle" style="font-size:24px;line-height:1;color:#111214;font-family:Arial, Helvetica, sans-serif;">&#128279;</td>
                                        </tr>
                                      </table>
                                    </td>
                                    <td valign="top" style="padding:0;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                                      <p style="margin:0 0 8px;font-size:18px;line-height:1.35;font-weight:900;color:#171717;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">Button not working?</p>
                                      <p style="margin:0 0 18px;font-size:14px;line-height:1.65;font-weight:500;color:#62656b;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">Copy and paste this secure link into your browser:</p>
                                      <div style="height:1px;line-height:1px;background:#e5e7eb;margin:0 0 18px;font-size:1px;">&nbsp;</div>
                                      <a href="${safeUrl}" style="display:block;font-size:14px;line-height:1.7;font-weight:800;color:#111214;text-decoration:none;word-break:break-all;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">${safeUrl}</a>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>

                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0;background:#fbfbfb;border:1px solid #dedfe3;border-radius:16px;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                            <tr>
                              <td valign="middle" width="60" class="email-icon-cell" style="width:60px;padding:24px 0 24px 28px;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                                <table role="presentation" width="48" height="48" cellspacing="0" cellpadding="0" border="0" style="width:48px;height:48px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e6e7ea;border-radius:50%;box-shadow:0 8px 18px rgba(17,17,17,0.08);font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                                  <tr>
                                    <td align="center" valign="middle" style="font-size:23px;line-height:1;color:#111214;font-family:Arial, Helvetica, sans-serif;">&#128737;</td>
                                  </tr>
                                </table>
                              </td>
                              <td style="padding:24px 28px 24px 16px;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                                <p style="margin:0;font-size:16px;line-height:1.76;font-weight:500;color:#383b40;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">If you did not request this reset, you can safely ignore this email. Your current password will remain unchanged.</p>
                              </td>
                            </tr>
                          </table>

                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;margin:38px 0 0;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                            <tr>
                              <td valign="middle" style="width:46%;padding:0;border-top:1px solid #e5e5e5;font-size:1px;line-height:1px;">&nbsp;</td>
                              <td align="center" valign="middle" style="width:8%;padding:0 10px;font-family:Arial, Helvetica, sans-serif;font-size:18px;line-height:1;color:#c9ccd1;">&#128737;</td>
                              <td valign="middle" style="width:46%;padding:0;border-top:1px solid #e5e5e5;font-size:1px;line-height:1px;">&nbsp;</td>
                            </tr>
                            <tr>
                              <td colspan="3" align="center" style="padding:24px 0 0;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                                <p style="margin:0 auto;max-width:410px;font-size:13px;line-height:1.72;font-weight:500;color:#858990;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">This is an automated security email from Aim4price. Please do not share this reset link with anyone.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding:24px 24px 0;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                    <p style="margin:0;font-size:12px;line-height:1.75;font-weight:500;color:#777b82;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">${AIM4PRICE_POSITIONING_TEXT}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await sendAim4priceEmail({
    to: input.to,
    subject,
    html,
    text,
  });
}
