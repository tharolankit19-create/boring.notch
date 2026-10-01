import { commerceConfig, required } from "./config";
export async function sendAccessEmail(email: string, token: string) {
  const url = `${commerceConfig.appUrl}/download?token=${encodeURIComponent(token)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${required("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: required("ACCESS_EMAIL_FROM"), to: [email],
      subject: "Your NotchSignal download",
      html: `<p>Your NotchSignal access is ready.</p><p><a href="${url}">Open your secure download page</a></p><p>This link expires in one hour. Request another any time using the purchase email.</p>`
    })
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
}
