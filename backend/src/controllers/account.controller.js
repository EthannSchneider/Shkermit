import { publicUser } from "../serializers/user.serializer.js";
import { SESSION_COOKIE_NAME } from "../config/security.js";

export function createAccountController({ accountService, cookieOptions }) {
  return {
    async updateBoardWallpaper(request, response) {
      const user = await accountService.updateBoardWallpaper(request.user, request.body?.boardWallpaper, request.file);
      response.json({ user: publicUser(user) });
    },

    async updateProfile(request, response) {
      const user = await accountService.updateProfile(request.user, request.body ?? {});
      response.json({ user: publicUser(user) });
    },

    async updatePassword(request, response) {
      const token = await accountService.updatePassword(request.user, request.body ?? {});
      response.cookie(SESSION_COOKIE_NAME, token, cookieOptions);
      response.json({ message: "Password updated." });
    },

    async deleteAccount(request, response) {
      await accountService.deleteAccount(request.user, request.body?.password);
      response.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
      response.status(204).end();
    },
  };
}
