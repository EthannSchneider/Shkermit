export function createEmailVerificationModel(prisma) {
  return {
    upsertForUser({ userId, tokenHash, expiresAt }) {
      return prisma.emailVerificationToken.upsert({
        where: { userId },
        create: { userId, tokenHash, expiresAt },
        update: { tokenHash, expiresAt },
      });
    },

    findValidByTokenHash(tokenHash, now) {
      return prisma.emailVerificationToken.findFirst({
        where: { tokenHash, expiresAt: { gt: now } },
      });
    },

    deleteByUserId(userId) {
      return prisma.emailVerificationToken.deleteMany({ where: { userId } });
    },

    deleteValidByTokenHash(tokenHash, now) {
      return prisma.emailVerificationToken.deleteMany({
        where: { tokenHash, expiresAt: { gt: now } },
      });
    },

    deleteExpired(now) {
      return prisma.emailVerificationToken.deleteMany({
        where: { expiresAt: { lte: now } },
      });
    },
  };
}
