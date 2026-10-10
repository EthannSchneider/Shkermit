import { HttpError } from "../utils/http-error.js";
import { validateBoardWallpaper, validateWallpaperImage, wallpaperStorageKey } from "../utils/board-wallpaper.js";

export function createBoardWallpaperService({ storage, withTransaction }) {
  async function remove(wallpaper) {
    const key = wallpaperStorageKey(wallpaper);
    if (!key) return;
    try {
      await storage.remove(key);
    } catch (error) {
      console.error("Could not remove an unused board wallpaper", error);
    }
  }

  return {
    remove,
    async update(userId, wallpaper, file) {
      let uploadedWallpaper;
      if (file) {
        validateWallpaperImage(file);
        uploadedWallpaper = `custom:${await storage.store(file)}`;
      }
      let result;
      try {
        result = await withTransaction(async ({ userModel }) => {
          const previous = await userModel.findById(userId);
          if (!previous) throw new HttpError(404, "User not found.");
          // A user may keep the custom image already assigned to their account.
          // Only an uploaded file can assign a new custom image.
          const selected = uploadedWallpaper ?? (wallpaperStorageKey(wallpaper) && wallpaper === previous.boardWallpaper
            ? wallpaper : validateBoardWallpaper(wallpaper));
          const user = await userModel.updateBoardWallpaper(userId, selected);
          return { user, previousWallpaper: previous.boardWallpaper };
        });
      } catch (error) {
        if (uploadedWallpaper) await remove(uploadedWallpaper);
        throw error;
      }
      if (result.previousWallpaper !== result.user.boardWallpaper) await remove(result.previousWallpaper);
      return result.user;
    },
  };
}
