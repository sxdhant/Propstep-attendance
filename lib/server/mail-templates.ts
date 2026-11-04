import "server-only";
import { sendMail } from "@/lib/server/mailer";

export function mailPasswordReset(to: string, link: string, minutes: number) {
  return sendMail(
    to,
    "Reset your password",
    `We received a request to reset your password.\n\nOpen this link within ${minutes} minutes:\n${link}\n\nIf you didn't ask for this, you can ignore this email. Your password won't change.`,
  );
}
