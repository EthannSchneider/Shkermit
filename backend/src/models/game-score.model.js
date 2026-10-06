export function createGameScoreModel(prisma) {
  const whereFor = (userId, game, mode) => ({
    userId_game_mode: { userId, game, mode },
  });

  return {
    find(userId, game, mode) {
      return prisma.gameScore.findUnique({ where: whereFor(userId, game, mode) });
    },

    listBest(game, mode, limit) {
      return prisma.gameScore.findMany({
        where: { game, mode, score: { gt: 0 } },
        select: {
          score: true,
          user: { select: { username: true } },
        },
        orderBy: [{ score: "desc" }, { updatedAt: "asc" }, { id: "asc" }],
        take: limit,
      });
    },

    async saveBest(userId, game, mode, score) {
      await prisma.gameScore.upsert({
        where: whereFor(userId, game, mode),
        create: { userId, game, mode, score },
        update: {},
      });
      await prisma.gameScore.updateMany({
        where: { userId, game, mode, score: { lt: score } },
        data: { score },
      });
      return this.find(userId, game, mode);
    },
  };
}
