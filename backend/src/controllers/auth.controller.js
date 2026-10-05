import { publicUser } from "../serializers/user.serializer.js";
import { SESSION_COOKIE_NAME } from "../config/security.js";

export function createAuthController({ authService, cookieOptions }) {
  return {
    async register(request, response) {
      const { user, token } = await authService.register(request.body ?? {});
      response.cookie(SESSION_COOKIE_NAME, token, cookieOptions);
      response.status(201).json({ user: publicUser(user) });
    },

    async login(request, response) {
      const { user, token } = await authService.login(request.body ?? {});
      response.cookie(SESSION_COOKIE_NAME, token, cookieOptions);
      response.json({ user: publicUser(user) });
    },

    async logout(request, response) {
      await authService.logout(request.cookies[SESSION_COOKIE_NAME]);
      response.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
      response.status(204).end();
    },

    me(request, response) {
      response.json({ user: publicUser(request.user) });
    },
  };
}
