export function createGameScoreController({ gameScoreService }) {
  return {
    async leaderboard(_request, response) {
      response.json(await gameScoreService.leaderboard());
    },

    async get(request, response) {
      const result = await gameScoreService.get(
        request.user.id,
        request.params.game,
        request.params.mode,
      );
      response.json(result);
    },

    async save(request, response) {
      const result = await gameScoreService.save(
        request.user.id,
        request.params.game,
        request.params.mode,
        request.body?.score,
      );
      response.json(result);
    },
  };
}
