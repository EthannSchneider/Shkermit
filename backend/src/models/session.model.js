export function createSessionModel(prisma) {
  return {
    create({ tokenHash, userId, expiresAt }) {
      return prisma.session.create({
        data: { tokenHash, userId, expiresAt },
      });
    },

    findValidByTokenHash(tokenHash, now) {
      return prisma.session.findFirst({
        where: { tokenHash, expiresAt: { gt: now } },
      });
    },

    deleteByTokenHash(tokenHash) {
      return prisma.session.deleteMany({ where: { tokenHash } });
    },

    deleteByUserId(userId) {
      return prisma.session.deleteMany({ where: { userId } });
    },

    deleteExpired(now) {
      return prisma.session.deleteMany({
        where: { expiresAt: { lte: now } },
      });
    },
  };
}
