// server/email/email.js

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail({ to, token }) {
const verificationUrl = `${process.env.FRONTEND_URL}/verify-email-redirect?token=${token}`;

  return resend.emails.send({
    from: "Mapdex <noreply@mapdex.ca>",
    to,
    subject: "Verify your Mapdex account",
    html: `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #000;">
    <h2 style="margin-bottom: 16px;">Verify Your Account</h2>

    <p>
      Thanks for creating your Mapdex account.
    </p>

    <p>
      Please verify your email address by clicking the link below:
    </p>

    <p>
      <a href="${verificationUrl}" 
         style="color:#0000EE; text-decoration:underline;">
         Verify your email
      </a>
    </p>

    <p style="margin-top:24px; font-size: 14px; color: #555;">
      This link expires in 1 hour.
    </p>

    <p style="font-size: 14px; color: #555;">
      If you did not create this account, you can ignore this email.
    </p>
  </div>
`,
  });
}

export async function sendPasswordResetEmail({ to, token }) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  return resend.emails.send({
    from: "Mapdex <noreply@mapdex.ca>",
    to,
    subject: "Reset your Mapdex password",
    html: `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #000;">
    <h2 style="margin-bottom: 16px;">Password Reset</h2>

    <p>
      We received a request to reset your Mapdex password.
    </p>

    <p>
      Click the link below to choose a new password:
    </p>

    <p>
      <a href="${resetUrl}" 
         style="color:#0000EE; text-decoration:underline;">
         Reset your password
      </a>
    </p>

    <p style="margin-top:24px; font-size: 14px; color: #555;">
      This link expires in 1 hour.
    </p>

    <p style="font-size: 14px; color: #555;">
      If you did not request a password reset, you can safely ignore this email.
    </p>
  </div>
`,
  });
}