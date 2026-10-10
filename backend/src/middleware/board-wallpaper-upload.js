import multer from "multer";
import { HttpError } from "../utils/http-error.js";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1, parts: 2 },
  fileFilter(_request, file, callback) {
    if (!imageTypes.has(file.mimetype)) return callback(new HttpError(400, "Upload a JPEG, PNG, WebP, or GIF image."));
    callback(null, true);
  },
});

export function boardWallpaperUpload(request, response, next) {
  if (!request.is("multipart/form-data")) return next();
  if (!request.user?.isAdmin) return next(new HttpError(403, "Only administrators can upload custom board images."));
  upload.single("image")(request, response, (error) => {
    if (error instanceof multer.MulterError) {
      return next(new HttpError(400, error.code === "LIMIT_FILE_SIZE"
        ? "Images must be 5 MB or smaller." : "The image upload is invalid."));
    }
    next(error);
  });
}
