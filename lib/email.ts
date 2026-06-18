type SendAim4priceEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

const AIM4PRICE_EMAIL_FONT_STACK = '"Montserrat", Arial, Helvetica, sans-serif';
const AIM4PRICE_EMAIL_LOGO_URL =
  "https://www.aim4price.com/brand/Aim4price_Home_Logo.png";
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
        <title>Reset your Aim4price password</title>
      </head>
      <body style='margin:0;padding:0;background:#f4f3ef;color:#111111;font-family:${AIM4PRICE_EMAIL_FONT_STACK};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;'>
        <div style='display:none;max-height:0;max-width:0;opacity:0;overflow:hidden;font-size:1px;line-height:1px;color:#f4f3ef;'>
          Use the secure Aim4price link to set a new password for your account.
        </div>

        <table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0' style='width:100%;margin:0;padding:0;background:#f4f3ef;border-collapse:collapse;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>
          <tr>
            <td align='center' style='padding:40px 14px 36px;'>
              <table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0' style='width:100%;max-width:640px;margin:0 auto;border-collapse:collapse;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>
                <tr>
                  <td style='padding:0;'>
                    <table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0' style='width:100%;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #d9d7d0;border-radius:28px;box-shadow:0 22px 58px rgba(17,17,17,0.10);overflow:hidden;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>
                      <tr>
                        <td style='padding:34px 44px 38px;background:#111111;border-radius:28px 28px 0 0;color:#ffffff;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>
                          <table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0' style='width:100%;border-collapse:collapse;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>
                            <tr>
                              <td align='left' style='padding:0 0 28px;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>
                                <table role='presentation' cellspacing='0' cellpadding='0' border='0' style='border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #2f2f2f;border-radius:18px;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>
                                  <tr>
                                    <td align='center' style='padding:12px 18px;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>
                                      <img src='${AIM4PRICE_EMAIL_LOGO_URL}' width='300' alt='Aim4price' style='display:block;width:300px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;' />
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>

                          <div style='margin:0 0 12px;font-size:11px;line-height:1.3;font-weight:800;letter-spacing:4px;text-transform:uppercase;color:#bdbdbd;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>Password reset</div>
                          <h1 style='margin:0 0 14px;font-size:34px;line-height:1.12;font-weight:900;letter-spacing:-0.8px;color:#ffffff;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>Reset your password</h1>
                          <p style='margin:0;max-width:470px;font-size:15px;line-height:1.75;font-weight:500;color:#d9d9d9;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>A secure link was requested for your Aim4price account. Use it only if you started this password reset.</p>
                        </td>
                      </tr>

                      <tr>
                        <td style='padding:42px 44px 42px;background:#ffffff;border-radius:0 0 28px 28px;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>
                          <p style='margin:0 0 18px;font-size:17px;line-height:1.65;font-weight:600;color:#111111;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>Hi ${safeName},</p>

                          <p style='margin:0;font-size:16px;line-height:1.78;font-weight:500;color:#555555;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>We received a request to reset your Aim4price password. Use the button below to create a new password for your account.</p>

                          <table role='presentation' cellspacing='0' cellpadding='0' border='0' style='border-collapse:collapse;margin:32px 0 34px;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>
                            <tr>
                              <td align='center' bgcolor='#111111' style='border-radius:999px;background:#111111;box-shadow:0 12px 24px rgba(17,17,17,0.20);'>
                                <a href='${safeUrl}' style='display:inline-block;padding:16px 30px;border-radius:999px;background:#111111;color:#ffffff;font-size:15px;line-height:1.2;font-weight:900;letter-spacing:-0.1px;text-decoration:none;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>Set new password</a>
                              </td>
                            </tr>
                          </table>

                          <table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0' style='width:100%;border-collapse:separate;border-spacing:0;margin:0 0 30px;background:#fafafa;border:1px solid #dedede;border-radius:18px;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>
                            <tr>
                              <td style='padding:24px 24px 25px;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>
                                <p style='margin:0 0 8px;font-size:15px;line-height:1.45;font-weight:900;color:#111111;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>Button not working?</p>
                                <p style='margin:0 0 14px;font-size:13px;line-height:1.65;font-weight:500;color:#707070;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>Copy and paste this secure link into your browser:</p>
                                <a href='${safeUrl}' style='display:block;font-size:13px;line-height:1.65;font-weight:700;color:#111111;text-decoration:underline;word-break:break-all;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>${safeUrl}</a>
                              </td>
                            </tr>
                          </table>

                          <table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0' style='width:100%;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e4e4e4;border-radius:16px;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>
                            <tr>
                              <td style='padding:20px 22px;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>
                                <p style='margin:0;font-size:14px;line-height:1.75;font-weight:500;color:#5f5f5f;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>If you did not request this reset, you can safely ignore this email. Your current password will remain unchanged.</p>
                              </td>
                            </tr>
                          </table>

                          <table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0' style='width:100%;border-collapse:collapse;margin:34px 0 0;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>
                            <tr>
                              <td style='padding:24px 0 0;border-top:1px solid #e8e8e8;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>
                                <p style='margin:0;font-size:12px;line-height:1.7;font-weight:500;color:#8a8a8a;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>This is an automated security email from Aim4price. Please do not share this reset link with anyone.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td align='center' style='padding:24px 22px 0;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>
                    <p style='margin:0;font-size:12px;line-height:1.75;font-weight:500;color:#777777;font-family:${AIM4PRICE_EMAIL_FONT_STACK};'>${AIM4PRICE_POSITIONING_TEXT}</p>
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
