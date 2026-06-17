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
    readEnv("NEXT_PUBLIC_SITE_URL") ||
    readEnv("BETTER_AUTH_URL") ||
    readEnv("RAILWAY_PUBLIC_DOMAIN") ||
    readEnv("VERCEL_URL");

  if (!explicit) {
    return "http://localhost:3000";
  }

  const withProtocol = /^https?:\/\//i.test(explicit)
    ? explicit
    : `https://${explicit}`;

  try {
    const parsed = new URL(withProtocol);
    return parsed.origin;
  } catch {
    return "http://localhost:3000";
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
    "Aim4price <noreply@aim4price.com>"
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
    console.warn("RESEND_API_KEY is not set. Aim4price email was not sent.", {
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

export async function sendAim4priceResetPasswordEmail(input: {
  to: string;
  name?: string | null;
  resetUrl: string;
}): Promise<void> {
  const safeName = escapeHtml(input.name?.trim() || "Aim4price user");
  const safeUrl = escapeHtml(input.resetUrl);
  const subject = "Reset your Aim4price password";
  const text = [
    `Hi ${input.name?.trim() || "there"},`,
    "",
    "We received a request to reset your Aim4price password.",
    `Open this secure link to set a new password: ${input.resetUrl}`,
    "",
    "If you did not request this, you can ignore this email.",
    "",
    "Aim4price",
  ].join("\n");

  const html = `
    <!doctype html>
    <html>
      <body style="margin:0;background:#f4f7f5;font-family:Arial,sans-serif;color:#17362c;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f5;padding:28px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e9e4;border-radius:18px;overflow:hidden;">
                <tr>
                  <td style="padding:28px 28px 14px;background:linear-gradient(135deg,#102a23,#17385d);color:#ffffff;">
                    <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;opacity:.8;">Aim4price</div>
                    <h1 style="margin:10px 0 0;font-size:26px;line-height:1.15;">Reset your password</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px;">
                    <p style="margin:0 0 14px;font-size:16px;line-height:1.55;">Hi ${safeName},</p>
                    <p style="margin:0 0 20px;font-size:16px;line-height:1.55;color:#4f625b;">Use the button below to set a new Aim4price password. This link is only for your account.</p>
                    <p style="margin:0 0 24px;">
                      <a href="${safeUrl}" style="display:inline-block;background:#185a43;color:#ffffff;text-decoration:none;font-weight:800;border-radius:999px;padding:13px 20px;">Set new password</a>
                    </p>
                    <p style="margin:0 0 8px;font-size:13px;line-height:1.55;color:#6d7b76;">If the button does not work, copy and paste this link into your browser:</p>
                    <p style="margin:0;word-break:break-all;font-size:13px;line-height:1.55;color:#275b86;">${safeUrl}</p>
                    <hr style="border:0;border-top:1px solid #e5ece8;margin:24px 0;" />
                    <p style="margin:0;font-size:13px;line-height:1.55;color:#7a8782;">If you did not request this reset, ignore this email. Your current password will remain unchanged.</p>
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
