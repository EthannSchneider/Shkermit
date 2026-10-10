import { publicUser } from "../serializers/user.serializer.js";

function adminUser(user) {
  return { ...publicUser(user), canManage: !user.isAdminAccount };
}

export function createAdminUserController({ adminUserService }) {
  return {
    async updateBoardWallpaper(request, response) {
      const user = await adminUserService.updateBoardWallpaper(request.params.id, request.body?.boardWallpaper, request.file);
      response.json({ user: adminUser(user) });
    },

    async list(request, response) {
      const result = await adminUserService.list(request.query);
      response.json({ ...result, users: result.users.map(adminUser) });
    },

    async updateProfile(request, response) {
      const result = await adminUserService.updateProfile(request.user, request.params.id, request.body ?? {});
      response.json({ ...result, user: adminUser(result.user) });
    },

    async resendVerification(request, response) {
      await adminUserService.resendVerification(request.user, request.params.id);
      response.json({ message: "Confirmation email sent." });
    },

    async confirmEmail(request, response) {
      const user = await adminUserService.confirmEmail(request.user, request.params.id, request.body?.email);
      response.json({ user: adminUser(user) });
    },

    async deleteUser(request, response) {
      await adminUserService.deleteUser(request.user, request.params.id);
      response.status(204).end();
    },

    async setSuspended(request, response) {
      const user = await adminUserService.setSuspended(request.user, request.params.id, request.body?.suspended);
      response.json({ user: adminUser(user) });
    },
  };
}
