import { Router } from "express";

export function createGameScoreRouter({ controller, requireAuth }) {
  const router = Router();
  router.get("/leaderboard", controller.leaderboard);
  router.get("/:game/:mode", requireAuth, controller.get);
  router.put("/:game/:mode", requireAuth, controller.save);
  return router;
}
