import "server-only";
import { env } from "@/lib/server/env";

/**
 * Transactional email. Uses Resend when RESEND_API_KEY is set. Without it,
 * development prints the message to the server console; production logs that
 * mail is unconfigured (and never prints the message, which holds a secret link).
 */
export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  if (env.resendApiKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.mailFrom, to, subject, text }),
    });
    if (!response.ok) console.error(`Mail send failed with status ${response.status}`);
    return;
  }
  if (env.isProd) console.error("Email not sent: set RESEND_API_KEY (or replace lib/server/mailer.ts).");
  else console.log(`\n--- email (dev) to ${to} ---\n${subject}\n\n${text}\n---\n`);
}
