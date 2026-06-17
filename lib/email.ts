type SendAim4priceEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

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

function getPublicAssetUrl(pathname: string): string {
  const siteOrigin = getSiteOrigin();
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;

  try {
    return new URL(path, siteOrigin).toString();
  } catch {
    return `https://aim4price.com${path}`;
  }
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

function buildAim4priceResetPasswordEmailText(input: {
  name?: string | null;
  resetUrl: string;
}): string {
  const name = input.name?.trim() || "there";

  return [
    `Hi ${name},`,
    "",
    "We received a request to reset your Aim4price password.",
    "",
    "Use this secure link to set a new password:",
    input.resetUrl,
    "",
    "This reset link is only for your account. If you did not request this reset, you can ignore this email and your password will remain unchanged.",
    "",
    "Aim4price",
  ].join("\n");
}

function buildAim4priceResetPasswordEmailHtml(input: {
  name?: string | null;
  resetUrl: string;
}): string {
  const safeName = escapeHtml(input.name?.trim() || "Aim4price user");
  const safeUrl = escapeHtml(input.resetUrl);
  const logoUrl = escapeHtml(getPublicAssetUrl("/brand/Aim4price_Home_Logo.png"));
  const previewText = "Use this secure link to set a new Aim4price password.";

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <title>Reset your Aim4price password</title>
  </head>
  <body style="margin:0;padding:0;background:#edf4ef;font-family:Arial,Helvetica,sans-serif;color:#18332a;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;line-height:1px;font-size:1px;">
      ${previewText}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#edf4ef;margin:0;padding:0;">
      <tr>
        <td align="center" style="padding:34px 14px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;margin:0 auto;">
            <tr>
              <td align="center" style="padding:0 0 18px 0;">
                <img src="${logoUrl}" width="210" alt="Aim4price" style="display:block;width:210px;max-width:78%;height:auto;border:0;outline:none;text-decoration:none;">
              </td>
            </tr>

            <tr>
              <td style="background:#ffffff;border:1px solid #dbe7df;border-radius:22px;overflow:hidden;box-shadow:0 14px 34px rgba(16,47,40,0.10);">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;">
                  <tr>
                    <td style="background:#102f3f;background-image:linear-gradient(135deg,#0e3327 0%,#123f32 48%,#133b52 100%);padding:34px 34px 30px 34px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;">
                        <tr>
                          <td style="vertical-align:middle;">
                            <div style="font-size:12px;line-height:1.3;letter-spacing:1.8px;text-transform:uppercase;font-weight:700;color:#b9d9c8;">
                              Password reset
                            </div>
                            <h1 style="margin:10px 0 0 0;font-size:30px;line-height:1.18;font-weight:800;color:#ffffff;">
                              Reset your password
                            </h1>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:34px 34px 12px 34px;">
                      <p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;color:#203c33;">
                        Hi ${safeName},
                      </p>

                      <p style="margin:0 0 24px 0;font-size:16px;line-height:1.65;color:#4d6259;">
                        We received a request to reset your Aim4price password. Use the button below to create a new password for your account.
                      </p>

                      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 30px 0;">
                        <tr>
                          <td style="border-radius:999px;background:#1f6f4a;box-shadow:0 8px 16px rgba(31,111,74,0.22);">
                            <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:15px 25px;border-radius:999px;font-size:15px;line-height:1.2;font-weight:800;color:#ffffff;text-decoration:none;">
                              Set new password
                            </a>
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#f6faf7;border:1px solid #dceae2;border-radius:16px;">
                        <tr>
                          <td style="padding:18px 18px 17px 18px;">
                            <p style="margin:0 0 8px 0;font-size:14px;line-height:1.45;font-weight:800;color:#203c33;">
                              Button not working?
                            </p>
                            <p style="margin:0 0 10px 0;font-size:13px;line-height:1.55;color:#65786f;">
                              Copy and paste this secure link into your browser:
                            </p>
                            <p style="margin:0;font-size:13px;line-height:1.55;word-break:break-all;">
                              <a href="${safeUrl}" target="_blank" style="color:#1f6f4a;text-decoration:underline;">
                                ${safeUrl}
                              </a>
                            </p>
                          </td>
                        </tr>
                      </table>

                      <p style="margin:24px 0 0 0;font-size:14px;line-height:1.65;color:#697a73;">
                        If you did not request this reset, you can safely ignore this email. Your current password will remain unchanged.
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:22px 34px 32px 34px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #edf2ef;">
                        <tr>
                          <td style="padding-top:18px;">
                            <p style="margin:0;font-size:12px;line-height:1.65;color:#899891;">
                              This is an automated security email from Aim4price. Please do not share this reset link with anyone.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:18px 12px 0 12px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#7d8f87;">
                  Aim4price helps machinery owners, financiers, insurers and dealers make confident decisions with estimates, saved asset records and marketplace tools built for South Africa.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendAim4priceResetPasswordEmail(input: {
  to: string;
  name?: string | null;
  resetUrl: string;
}): Promise<void> {
  const subject = "Reset your Aim4price password";

  await sendAim4priceEmail({
    to: input.to,
    subject,
    html: buildAim4priceResetPasswordEmailHtml(input),
    text: buildAim4priceResetPasswordEmailText(input),
  });
}
