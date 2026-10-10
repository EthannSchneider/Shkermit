import { Router } from "express";
import { boardWallpaperUpload } from "../middleware/board-wallpaper-upload.js";

export function createAccountRouter({ controller, authRateLimit, requireAuth }) {
  const router = Router();
  router.patch("/", requireAuth, controller.updateProfile);
  router.patch("/wallpaper", requireAuth, boardWallpaperUpload, controller.updateBoardWallpaper);
  router.put("/password", requireAuth, authRateLimit, controller.updatePassword);
  router.delete("/", requireAuth, controller.deleteAccount);
  return router;
}
