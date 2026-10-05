import { publicPicture } from "../serializers/picture.serializer.js";
import { HttpError } from "../utils/http-error.js";

export function createPictureController({ pictureService }) {
  return {
    async list(_request, response) {
      const pictures = await pictureService.list();
      response.json({ pictures: pictures.map(publicPicture) });
    },

    async content(request, response, next) {
      const picture = await pictureService.content(request.params.id);
      response.set({
        "Content-Type": picture.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      });
      response.sendFile(picture.path, (error) => {
        if (error) next(error.statusCode === 404 ? new HttpError(404, "Picture content not found.") : error);
      });
    },

    async create(request, response) {
      const picture = await pictureService.create(request.body ?? {}, request.file);
      response.status(201).json({ picture: publicPicture(picture) });
    },

    async update(request, response) {
      const picture = await pictureService.update(request.params.id, request.body ?? {}, request.file);
      response.json({ picture: publicPicture(picture) });
    },

    async delete(request, response) {
      await pictureService.delete(request.params.id);
      response.status(204).end();
    },

    async move(request, response) {
      const pictures = await pictureService.move(request.params.id, request.body?.direction);
      response.json({ pictures: pictures.map(publicPicture) });
    },
  };
}
