import { HttpError } from "./http-error.js";

export function validateImageFile(file) {
  const bytes = file.buffer;
  const valid = Buffer.isBuffer(bytes) && (
    (file.mimetype === "image/png" && bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) && bytes.toString("ascii", 12, 16) === "IHDR")
    || (file.mimetype === "image/jpeg" && bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    || (file.mimetype === "image/gif" && bytes.length >= 13 && ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6)))
    || (file.mimetype === "image/webp" && bytes.length >= 20 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP")
  );
  if (!valid) throw new HttpError(400, "The file must contain a JPEG, PNG, WebP, or GIF image matching its file type.");
}
