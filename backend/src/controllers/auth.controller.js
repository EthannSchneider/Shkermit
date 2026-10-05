import { publicUser } from "../serializers/user.serializer.js";
import { SESSION_COOKIE_NAME } from "../config/security.js";

export function createAuthController({ authService, cookieOptions }) {
  return {
    async register(request, response) {
      const user = await authService.register(request.body ?? {});
      response.status(201).json({
        message: "Check your inbox to confirm your email.",
        email: user.email,
      });
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

    async verifyEmail(request, response) {
      const { user, token } = await authService.verifyEmail(request.body?.token);
      response.cookie(SESSION_COOKIE_NAME, token, cookieOptions);
      response.json({ user: publicUser(user) });
    },

    async resendVerification(request, response) {
      await authService.resendVerification(request.body?.email);
      response.status(202).json({
        message: "If that address belongs to an unverified account, a new email is on its way.",
      });
    },

    me(request, response) {
      response.json({ user: publicUser(request.user) });
    },
  };
}
