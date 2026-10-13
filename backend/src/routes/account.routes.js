import { Router } from "express";
import { boardWallpaperUpload } from "../middleware/board-wallpaper-upload.js";
import { profilePictureUpload } from "../middleware/profile-picture-upload.js";

export function createAccountRouter({ controller, authRateLimit, requireAuth }) {
  const router = Router();
  router.patch("/", requireAuth, controller.updateProfile);
  router.patch("/profile-picture", requireAuth, profilePictureUpload, controller.updateProfilePicture);
  router.delete("/profile-picture", requireAuth, controller.removeProfilePicture);
  router.patch("/wallpaper", requireAuth, boardWallpaperUpload, controller.updateBoardWallpaper);
  router.put("/password", requireAuth, authRateLimit, controller.updatePassword);
  router.delete("/", requireAuth, controller.deleteAccount);
  return router;
}
