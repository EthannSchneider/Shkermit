import crypto from "node:crypto";
import { HttpError } from "../utils/http-error.js";
import { normalizedEmail } from "../utils/validation.js";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createEmailVerificationService({
  userModel,
  emailVerificationModel,
  mailer,
  withTransaction,
  appUrl,
  tokenTtlMs,
}) {
  async function send(user) {
    if (user.emailVerifiedAt) return;

    const token = crypto.randomBytes(32).toString("base64url");
    await emailVerificationModel.upsertForUser({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + tokenTtlMs),
    });

    const verificationUrl = new URL("/verify-email", appUrl);
    verificationUrl.searchParams.set("token", token);
    verificationUrl.searchParams.set("email", user.email);
    await mailer.sendVerificationEmail({
      to: user.email,
      username: user.username,
      verificationUrl: verificationUrl.toString(),
    });
  }

  return {
    send,

    async resend(email) {
      if (typeof email !== "string") return;
      const user = await userModel.findByEmail(normalizedEmail(email));
      if (user && !user.emailVerifiedAt) {
        try {
          await send(user);
        } catch (error) {
          console.error("Could not resend verification email", error);
        }
      }
    },

    async verify(token) {
      if (typeof token !== "string" || token.length < 32 || token.length > 256) {
        throw new HttpError(400, "This verification link is invalid or has expired.");
      }

      const record = await emailVerificationModel.findValidByTokenHash(
        hashToken(token),
        new Date(),
      );
      if (!record) {
        throw new HttpError(400, "This verification link is invalid or has expired.");
      }

      return withTransaction(async ({ userModel: transactionUsers, emailVerificationModel: transactionTokens }) => {
        const consumed = await transactionTokens.deleteValidByTokenHash(
          hashToken(token),
          new Date(),
        );
        if (consumed.count !== 1) {
          throw new HttpError(400, "This verification link is invalid or has expired.");
        }
        const user = await transactionUsers.markEmailVerified(record.userId);
        return user;
      });
    },
  };
}
