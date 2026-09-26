/** Shared email branding, using inline styles for Gmail and Outlook compatibility. */
export const AIM4PRICE_EMAIL_FONT_STACK = 'Montserrat, Arial, Helvetica, sans-serif';
export const AIM4PRICE_EMAIL_LOGO_PATH = '/brand/aim4price-mark-black.png';

export function buildEmailBrandHeader(logoUrl: string): string {
  const safeLogo = logoUrl.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return `<tr><td class="email-brand" bgcolor="#edf6f0" style="padding:24px 30px;background:#edf6f0;border-bottom:1px solid #d7e5dc;border-radius:12px 12px 0 0;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;"><tr>
      <td valign="middle" width="64" style="width:64px;padding-right:16px;"><img src="${safeLogo}" width="48" height="37" alt="Aim4price logo" style="display:block;width:48px;height:37px;border:0;outline:none;" /></td>
      <td valign="middle" style="font-family:${AIM4PRICE_EMAIL_FONT_STACK};"><div style="color:#173c32;font-size:23px;line-height:30px;font-weight:700;letter-spacing:-.6px;">Aim4price.com</div><div style="color:#64786f;font-size:12px;line-height:18px;margin-top:3px;">Asset Intelligence &amp; Management</div></td>
    </tr></table>
  </td></tr>`;
}
