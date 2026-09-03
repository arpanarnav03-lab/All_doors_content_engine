const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendPasswordResetEmail(toEmail, resetToken) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
    to: toEmail,
    subject: "Reset your password",
    html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p>
           <p><a href="${resetUrl}">${resetUrl}</a></p>
           <p>If you didn't request this, ignore this email.</p>`,
  });

  // The Resend SDK does NOT throw on API-level failures (bad `from`
  // domain, sandbox restrictions, invalid recipient, etc.) - it resolves
  // with { data: null, error: {...} }. Verified directly: a 403 sandbox
  // rejection resolved successfully with no exception. Without this
  // check, the caller's try/catch (meant to log delivery failures without
  // leaking them to the client) would never actually fire.
  if (result.error) {
    throw new Error(result.error.message || "Resend API returned an error");
  }
}

module.exports = { sendPasswordResetEmail };
