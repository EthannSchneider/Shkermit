import { HttpError } from "./http-error.js";

export const BOARD_WALLPAPERS = ["classic", "pond", "sunset", "space", "shkermit", "thug"];

export function wallpaperStorageKey(value) {
  return typeof value === "string"
    ? /^custom:([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(?:jpg|png|webp|gif))$/.exec(value)?.[1] ?? null
    : null;
}

export { validateImageFile as validateWallpaperImage } from "./image-file.js";

export function validateBoardWallpaper(value) {
  if (typeof value !== "string" || !BOARD_WALLPAPERS.includes(value)) {
    throw new HttpError(400, "Choose a valid board wallpaper.");
  }
  return value;
}
