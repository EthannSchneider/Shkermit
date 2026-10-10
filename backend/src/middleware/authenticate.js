import { SESSION_COOKIE_NAME } from "../config/security.js";

export function createAuthenticationMiddleware({ sessionService, userModel }) {
  return async (request, response, next) => {
    try {
      const session = await sessionService.findValid(request.cookies[SESSION_COOKIE_NAME]);
      const user = session ? await userModel.findById(session.userId) : null;

      if (!user) {
        response.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
        return response.status(401).json({
          error: request.cookies[SESSION_COOKIE_NAME]
            ? "Your session has expired."
            : "Authentication required.",
        });
      }

      if (user.suspendedAt) {
        response.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
        return response.status(403).json({ error: "Your account has been suspended.", code: "ACCOUNT_SUSPENDED" });
      }

      request.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}
