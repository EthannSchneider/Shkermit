import { HttpError } from "../utils/http-error.js";
import { validateImageFile } from "../utils/image-file.js";

export function createProfilePictureService({ storage, withTransaction }) {
  async function remove(key) {
    if (!key) return;
    try {
      await storage.remove(key);
    } catch (error) {
      console.error("Could not remove an unused profile picture", error);
    }
  }

  return {
    remove,
    async update(userId, file) {
      let key = null;
      if (file) {
        validateImageFile(file);
        key = await storage.store(file);
      }
      let result;
      try {
        result = await withTransaction(async ({ userModel }) => {
          const previous = await userModel.findById(userId);
          if (!previous) throw new HttpError(404, "User not found.");
          const user = await userModel.updateProfilePicture(userId, key);
          return { user, previousKey: previous.profilePicture };
        });
      } catch (error) {
        await remove(key);
        throw error;
      }
      await remove(result.previousKey);
      return result.user;
    },
  };
}
