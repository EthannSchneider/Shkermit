import { Router } from "express";

export function createAccountRouter({ controller, authRateLimit, requireAuth }) {
  const router = Router();
  router.patch("/", requireAuth, controller.updateProfile);
  router.put("/password", requireAuth, authRateLimit, controller.updatePassword);
  router.delete("/", requireAuth, controller.deleteAccount);
  return router;
}
