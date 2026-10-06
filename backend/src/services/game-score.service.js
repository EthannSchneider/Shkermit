import { HttpError } from "../utils/http-error.js";

const GAME_MODES = new Map([
  ["clicker", new Set(["classic"])],
  ["snake", new Set(["classic"])],
  ["tetris", new Set(["solo", "coop", "duel"])],
]);
const MAX_SCORE = 2_147_483_647;
const LEADERBOARD_MODES = [...GAME_MODES.entries()].flatMap(([game, modes]) =>
  [...modes].map((mode) => ({ game, mode }))
);

function validateGameMode(game, mode) {
  if (!GAME_MODES.get(game)?.has(mode)) {
    throw new HttpError(400, "Unknown game or gameplay mode.");
  }
}

export function createGameScoreService({ gameScoreModel }) {
  return {
    async leaderboard(limit = 10) {
      const leaderboards = await Promise.all(LEADERBOARD_MODES.map(async ({ game, mode }) => {
        const scores = await gameScoreModel.listBest(game, mode, limit);
        return {
          game,
          mode,
          entries: scores.map((entry, index) => ({
            rank: index + 1,
            username: entry.user.username,
            score: entry.score,
          })),
        };
      }));
      return { leaderboards };
    },

    async get(userId, game, mode) {
      validateGameMode(game, mode);
      const result = await gameScoreModel.find(userId, game, mode);
      return { game, mode, score: result?.score ?? 0 };
    },

    async save(userId, game, mode, value, { trusted = false } = {}) {
      validateGameMode(game, mode);
      if (game === "tetris" && mode !== "solo" && !trusted) {
        throw new HttpError(403, "Multiplayer Tetris scores are recorded by the game server.");
      }
      if (!Number.isSafeInteger(value) || value < 0 || value > MAX_SCORE) {
        throw new HttpError(400, "Score must be a non-negative integer.");
      }
      const result = await gameScoreModel.saveBest(userId, game, mode, value);
      return { game, mode, score: result.score };
    },
  };
}
