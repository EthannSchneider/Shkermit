import { HttpError } from "../utils/http-error.js";

const MAX_TITLE_LENGTH = 100;
const MAX_ALT_TEXT_LENGTH = 240;

function requiredText(value, label, maximum) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new HttpError(400, `${label} is required.`);
  if (text.length > maximum) {
    throw new HttpError(400, `${label} must be ${maximum} characters or fewer.`);
  }
  return text;
}

function pictureId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, "Picture not found.");
  return id;
}

export function createPictureService({ pictureModel, pictureStorage }) {
  async function existingPicture(idValue) {
    const id = pictureId(idValue);
    const picture = await pictureModel.findById(id);
    if (!picture) throw new HttpError(404, "Picture not found.");
    return picture;
  }

  return {
    list() {
      return pictureModel.list();
    },

    async content(idValue) {
      const id = pictureId(idValue);
      const picture = await pictureModel.findContentById(id);
      if (!picture?.storageKey || !picture.mimeType) {
        throw new HttpError(404, "Picture content not found.");
      }
      return { ...picture, path: pictureStorage.pathFor(picture.storageKey) };
    },

    async create(fields, file) {
      if (!file) throw new HttpError(400, "Choose an image to upload.");
      const data = {
        title: requiredText(fields.title, "Title", MAX_TITLE_LENGTH),
        altText: requiredText(fields.altText, "Alternative text", MAX_ALT_TEXT_LENGTH),
        mimeType: file.mimetype,
        filename: file.originalname,
        position: await pictureModel.nextPosition(),
      };
      const storageKey = await pictureStorage.store(file);
      try {
        return await pictureModel.create({ ...data, storageKey });
      } catch (error) {
        await pictureStorage.remove(storageKey);
        throw error;
      }
    },

    async update(idValue, fields, file) {
      const picture = await existingPicture(idValue);
      const data = {};
      if (fields.title !== undefined) {
        data.title = requiredText(fields.title, "Title", MAX_TITLE_LENGTH);
      }
      if (fields.altText !== undefined) {
        data.altText = requiredText(fields.altText, "Alternative text", MAX_ALT_TEXT_LENGTH);
      }
      let newStorageKey;
      if (file) {
        newStorageKey = await pictureStorage.store(file);
        data.storageKey = newStorageKey;
        data.mimeType = file.mimetype;
        data.filename = file.originalname;
        data.assetKey = null;
      }
      if (Object.keys(data).length === 0) return picture;
      try {
        const updated = await pictureModel.update(picture.id, data);
        if (newStorageKey) await pictureStorage.remove(picture.storageKey);
        return updated;
      } catch (error) {
        if (newStorageKey) await pictureStorage.remove(newStorageKey);
        throw error;
      }
    },

    async delete(idValue) {
      const picture = await existingPicture(idValue);
      await pictureModel.delete(picture.id);
      await pictureStorage.remove(picture.storageKey);
    },

    async move(idValue, direction) {
      const id = pictureId(idValue);
      if (direction !== "up" && direction !== "down") {
        throw new HttpError(400, "Direction must be up or down.");
      }
      const pictures = await pictureModel.move(id, direction);
      if (!pictures) throw new HttpError(404, "Picture not found.");
      return pictures;
    },
  };
}
