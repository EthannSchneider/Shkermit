import crypto from "node:crypto";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createSessionService({ sessionModel, sessionTtlMs }) {
  return {
    async create(userId) {
      const token = crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + sessionTtlMs);
      await sessionModel.create({ tokenHash: hashToken(token), userId, expiresAt });
      return token;
    },

    findValid(token) {
      if (!token) return null;
      return sessionModel.findValidByTokenHash(hashToken(token), new Date());
    },

    delete(token) {
      if (!token) return Promise.resolve();
      return sessionModel.deleteByTokenHash(hashToken(token));
    },

    deleteAllForUser(userId) {
      return sessionModel.deleteByUserId(userId);
    },
  };
}

export function sessionCookieOptions(sessionTtlMs, isProduction) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    maxAge: sessionTtlMs,
    path: "/",
  };
}
