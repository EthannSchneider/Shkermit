import { Router } from "express";

export function createAuthRouter({ controller, authRateLimit, requireAuth }) {
  const router = Router();
  router.post("/register", authRateLimit, controller.register);
  router.post("/login", authRateLimit, controller.login);
  router.post("/logout", controller.logout);
  router.get("/me", requireAuth, controller.me);
  return router;
}
