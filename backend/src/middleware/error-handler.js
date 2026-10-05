import { HttpError } from "../utils/http-error.js";

export function errorHandler(error, _request, response, _next) {
  if (error instanceof HttpError) {
    return response.status(error.status).json({ error: error.message, ...error.details });
  }
  if (error instanceof SyntaxError && error.status === 400) {
    return response.status(400).json({ error: "Request body contains invalid JSON." });
  }

  console.error(error);
  return response.status(500).json({ error: "An unexpected server error occurred." });
}
