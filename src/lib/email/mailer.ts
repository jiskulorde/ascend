// src/lib/email/mailer.ts
import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
const port = Number(process.env.SMTP_PORT ?? 587);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;

if (!user || !pass) {
  // Don’t crash import in dev; we’ll still throw when sending.
  console.warn("[mailer] SMTP_USER / SMTP_PASS are not configured.");
}

export const mailer = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: {
    user,
    pass,
  },
});

type Role = "CLIENT" | "AGENT" | "MANAGER" | "ADMIN";

export async function sendRoleChangeEmail(opts: {
  to: string;
  newRole: Role;
  confirmUrl: string;
  targetName?: string | null;
  requestedByEmail?: string | null;
}) {
  if (!user || !pass) {
    throw new Error("SMTP credentials are not configured.");
  }

  const { to, newRole, confirmUrl, targetName, requestedByEmail } = opts;

  const subject = `Ascend DMCI • Role change request: ${newRole}`;
  const greeting = targetName ? `Hi ${targetName},` : "Hi,";

  const text = `${greeting}

An administrator is requesting to change your role to "${newRole}" in Ascend • DMCI.

To review and confirm this change, open the link below:

${confirmUrl}

If you did not expect this email, you can safely ignore it and your role will stay the same.${
    requestedByEmail
      ? `

Requested by: ${requestedByEmail}`
      : ""
  }

— Ascend DMCI`;

  const html = `
    <p>${greeting}</p>
    <p>
      An administrator is requesting to change your role to
      <strong>${newRole}</strong> in <strong>Ascend • DMCI</strong>.
    </p>
    <p>
      To review and confirm this change, click the button below:
    </p>
    <p>
      <a href="${confirmUrl}"
         style="display:inline-block;padding:10px 18px;border-radius:999px;
                background:#111827;color:#ffffff;text-decoration:none;
                font-weight:600;font-size:14px;">
        Review role change
      </a>
    </p>
    <p style="font-size:12px;color:#6b7280;">
      Or open this link:<br/>
      <a href="${confirmUrl}">${confirmUrl}</a>
    </p>
    <p style="font-size:12px;color:#6b7280;">
      If you did not expect this email, you can safely ignore it and your
      role will stay the same.
    </p>
    ${
      requestedByEmail
        ? `<p style="font-size:12px;color:#6b7280;">
             Requested by: ${requestedByEmail}
           </p>`
        : ""
    }
    <p style="font-size:12px;color:#6b7280;">— Ascend DMCI</p>
  `;

  await mailer.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}
