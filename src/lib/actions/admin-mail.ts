"use server";

import { deliverMail, type MailDelivery } from "@/lib/email/zeptomail";
import { requireAdmin } from "@/lib/session";

/** Sends one note to the signed-in admin and returns the ZeptoMail result. The token is already redacted. */
export async function sendAdminTestEmail(prev: MailDelivery | null, formData: FormData): Promise<MailDelivery> {
  void prev;
  void formData;
  const admin = await requireAdmin();
  return deliverMail({
    to: admin.email,
    name: admin.name || "Rangach Admin",
    subject: "Rangach mail test",
    text: "This is a test email from the Rangach admin page. If you can read it, ZeptoMail accepted the message.",
  });
}
