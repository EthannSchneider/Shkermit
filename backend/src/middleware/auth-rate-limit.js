import rateLimit from "express-rate-limit";

export function createAuthRateLimit(isProduction) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isProduction ? 20 : 500,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many attempts. Please try again later." },
  });
}
