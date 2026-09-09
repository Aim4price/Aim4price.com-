type SendAim4priceEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

const AIM4PRICE_EMAIL_FONT_STACK =
  'Montserrat, Arial, Helvetica, sans-serif';
const AIM4PRICE_EMAIL_LOGO_PATH = "/brand/aim4price-mark-black.png";
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
    "Choose a new password for your Aim4price account using the link below.",
    "",
    "Reset password:",
    input.resetUrl,
    "",
    "Didn't request this? You can ignore this email. Your password will stay the same.",
    "Keep this link private. Only use it if you requested a password reset.",
    "",
    "Aim4price",
  ].join("\n");

  // Inline styles and presentation tables remain usable when email clients
  // remove the head styles. The fixed Outlook wrapper supplies max-width support.
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${subject}</title>
    <style>
      @media only screen and (max-width: 620px) {
        .email-shell { padding: 16px 12px !important; }
        .email-brand { padding: 24px !important; }
        .email-body { padding: 28px 24px !important; }
        .email-title { font-size: 28px !important; }
        .email-button { width: 100% !important; }
        .email-button a { display: block !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f1f7f3;color:#123b30;font-family:${AIM4PRICE_EMAIL_FONT_STACK};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
    <div style="display:none;max-height:0;max-width:0;opacity:0;overflow:hidden;font-size:1px;line-height:1px;mso-hide:all;">Your link to choose a new Aim4price password. Didn’t request it? You can ignore this email.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f1f7f3" style="width:100%;border-collapse:collapse;">
      <tr>
        <td align="center" class="email-shell" style="padding:32px 16px;">
          <!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-card" style="width:100%;max-width:600px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #d7e5dc;border-radius:20px;">
            <tr>
              <td class="email-brand" bgcolor="#edf6f0" style="padding:24px 36px;background:#edf6f0;border-bottom:1px solid #d7e5dc;border-radius:20px 20px 0 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td valign="middle" width="56" style="width:56px;padding-right:12px;">
                      <img src="${logoUrl}" width="44" height="34" alt="" style="display:block;width:44px;height:34px;border:0;outline:none;" />
                    </td>
                    <td valign="middle" style="color:#123b30;font-family:${AIM4PRICE_EMAIL_FONT_STACK};font-size:23px;line-height:30px;font-weight:800;letter-spacing:-0.6px;">Aim4price</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-body" style="padding:32px 36px;background:#ffffff;border-radius:0 0 20px 20px;font-family:${AIM4PRICE_EMAIL_FONT_STACK};">
                <h1 class="email-title" style="margin:0 0 22px;color:#123b30;font-family:${AIM4PRICE_EMAIL_FONT_STACK};font-size:32px;line-height:1.2;font-weight:800;letter-spacing:-0.8px;">Reset your password</h1>
                <p style="margin:0 0 10px;color:#243c35;font-size:16px;line-height:1.6;overflow-wrap:anywhere;">Hi ${safeName},</p>
                <p style="margin:0;color:#52675e;font-size:16px;line-height:1.6;">Choose a new password for your Aim4price account using the button below.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="email-button" style="border-collapse:separate;margin:24px 0;">
                  <tr>
                    <td align="center" bgcolor="#184d3d" style="background:#184d3d;border:1px solid #184d3d;border-radius:10px;mso-padding-alt:15px 28px;">
                      <a href="${safeUrl}" style="display:inline-block;padding:15px 28px;color:#ffffff;background:#184d3d;border-radius:10px;font-family:${AIM4PRICE_EMAIL_FONT_STACK};font-size:16px;line-height:22px;font-weight:700;text-align:center;text-decoration:none;mso-padding-alt:0;">Reset password</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;color:#52675e;font-size:13px;line-height:1.6;">If the button doesn’t work, copy this link into your browser:</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;table-layout:fixed;border-collapse:collapse;">
                  <tr>
                    <td style="padding:0 0 24px;word-break:break-all;overflow-wrap:anywhere;">
                      <a href="${safeUrl}" style="color:#176b50;font-family:${AIM4PRICE_EMAIL_FONT_STACK};font-size:12px;line-height:1.6;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere;">${safeUrl}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 0 0;border-top:1px solid #e2ebe5;">
                      <p style="margin:0 0 8px;color:#52675e;font-size:13px;line-height:1.6;"><strong style="color:#243c35;">Didn’t request this?</strong> You can ignore this email. Your password will stay the same.</p>
                      <p style="margin:0;color:#52675e;font-size:12px;line-height:1.6;">Keep this link private. Only use it if you requested a password reset.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <!--[if mso]></td></tr></table><![endif]-->
          <p style="margin:18px 0 0;color:#52675e;font-family:${AIM4PRICE_EMAIL_FONT_STACK};font-size:12px;line-height:1.6;">Aim4price · Know what you have. Know what it’s worth. Know what it costs.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  await sendAim4priceEmail({ to: input.to, subject, html, text });
}
