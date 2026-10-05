import crypto from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const extensions = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

export function createPictureStorage(directory) {
  const root = path.resolve(directory);

  return {
    async store(file) {
      await mkdir(root, { recursive: true });
      const storageKey = `${crypto.randomUUID()}${extensions.get(file.mimetype)}`;
      await writeFile(path.join(root, storageKey), file.buffer, { flag: "wx" });
      return storageKey;
    },

    pathFor(storageKey) {
      if (!/^[a-f0-9-]+\.(?:jpg|png|webp|gif)$/.test(storageKey)) {
        throw new Error("Invalid picture storage key.");
      }
      return path.join(root, storageKey);
    },

    async remove(storageKey) {
      if (!storageKey) return;
      try {
        await unlink(this.pathFor(storageKey));
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    },
  };
}
