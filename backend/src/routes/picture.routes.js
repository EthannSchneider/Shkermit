import { Router } from "express";
import multer from "multer";
import { HttpError } from "../utils/http-error.js";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5 },
  fileFilter(_request, file, callback) {
    if (!allowedImageTypes.has(file.mimetype)) {
      return callback(new HttpError(400, "Upload a JPEG, PNG, WebP, or GIF image."));
    }
    callback(null, true);
  },
});

function pictureUpload(request, response, next) {
  upload.single("image")(request, response, (error) => {
    if (error instanceof multer.MulterError) {
      const message = error.code === "LIMIT_FILE_SIZE"
        ? "Images must be 5 MB or smaller."
        : "The image upload is invalid.";
      return next(new HttpError(400, message));
    }
    next(error);
  });
}

export function createPictureRouter({ controller, requireAuth, requireAdmin }) {
  const router = Router();
  router.get("/", controller.list);
  router.get("/:id/content", controller.content);
  router.post("/", requireAuth, requireAdmin, pictureUpload, controller.create);
  router.patch("/:id/position", requireAuth, requireAdmin, controller.move);
  router.patch("/:id", requireAuth, requireAdmin, pictureUpload, controller.update);
  router.delete("/:id", requireAuth, requireAdmin, controller.delete);
  return router;
}
