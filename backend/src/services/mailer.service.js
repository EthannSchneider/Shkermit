import nodemailer from "nodemailer";

export function createMailer({ isProduction, smtp, from }) {
  if (!smtp.host) {
    if (isProduction) {
      throw new Error("SMTP_HOST must be configured in production.");
    }

    return {
      async sendVerificationEmail({ to, verificationUrl }) {
        console.info(`[development email] Verify ${to}: ${verificationUrl}`);
      },
    };
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    ...(smtp.user ? { auth: { user: smtp.user, pass: smtp.password } } : {}),
  });

  return {
    async sendVerificationEmail({ to, username, verificationUrl }) {
      await transporter.sendMail({
        from,
        to,
        subject: "Confirm your Shkermit email",
        text: `Hi ${username},\n\nConfirm your email address by opening this link:\n${verificationUrl}\n\nThis link will expire. If you did not create this account, you can ignore this email.`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#142018">
            <h1 style="color:#166534">Welcome to Shkermit</h1>
            <p>Hi ${username},</p>
            <p>Confirm your email address to activate your account.</p>
            <p><a href="${verificationUrl}" style="display:inline-block;padding:12px 18px;background:#15803d;color:#fff;text-decoration:none;border-radius:6px">Confirm email</a></p>
            <p>This link will expire. If you did not create this account, you can ignore this email.</p>
          </div>
        `,
      });
    },
  };
}
