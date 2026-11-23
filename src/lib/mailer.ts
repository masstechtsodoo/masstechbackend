import { env } from "../env.js";
import type { Message } from "../db/schema.js";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Sends a notification for a new contact message. Returns false (never throws) when not configured or failing. */
export async function notifyNewMessage(m: Message): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  const rows: [string, string | null][] = [
    ["Name", m.name],
    ["Phone", m.phone],
    ["Email", m.email],
    ["Organization", m.organization],
    ["Product", m.product],
    ["Language", m.locale],
  ];
  const html = `
    <h2 style="font-family:sans-serif">New website inquiry #${m.id}</h2>
    <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
      ${rows
        .filter(([, v]) => v)
        .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${k}</td><td>${escapeHtml(v!)}</td></tr>`)
        .join("")}
    </table>
    <p style="font-family:sans-serif;font-size:14px;white-space:pre-wrap;margin-top:16px">${escapeHtml(m.message)}</p>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.CONTACT_FROM_EMAIL,
        to: [env.CONTACT_TO_EMAIL],
        reply_to: m.email,
        subject: `${m.product ? `[${m.product}] ` : ""}Website inquiry — ${m.organization || m.name}`,
        html,
      }),
    });
    if (!res.ok) console.warn("Resend error", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.warn("Resend request failed", e);
    return false;
  }
}
