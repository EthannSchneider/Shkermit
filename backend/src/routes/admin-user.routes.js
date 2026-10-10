import { Router } from "express";

export function createAdminUserRouter({ controller, requireAuth, requireAdmin, authRateLimit }) {
  const router = Router();
  router.use(requireAuth, requireAdmin);
  router.get("/", controller.list);
  router.patch("/:id", controller.updateProfile);
  router.patch("/:id/suspension", controller.setSuspended);
  router.post("/:id/resend-verification", authRateLimit, controller.resendVerification);
  router.post("/:id/confirm-email", controller.confirmEmail);
  router.delete("/:id", controller.deleteUser);
  return router;
}
