import { HttpError } from "../utils/http-error.js";
import { isUniqueConstraint } from "../utils/sqlite-errors.js";
import { normalizedEmail, normalizedUsername, validateEmail, validateUsername } from "../utils/validation.js";

function userId(value) {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    throw new HttpError(400, "Invalid user ID.");
  }
  return Number(value);
}

async function manageableUser(model, id, actor) {
  const user = await model.findById(userId(id));
  if (!user) throw new HttpError(404, "User not found.");
  if (user.id === actor.id || user.isAdminAccount) {
    throw new HttpError(403, "Administrator accounts are protected. Use account settings for your own profile.");
  }
  return user;
}

export function createAdminUserService({ userModel, emailVerificationService, withTransaction }) {
  return {
    async list({ search = "", page = "1" }) {
      if (typeof search !== "string" || search.length > 254 || typeof page !== "string" ||
          !/^\d+$/.test(page) || !Number.isSafeInteger(Number(page)) || Number(page) < 1 || Number(page) > 1000000) {
        throw new HttpError(400, "Invalid search or page.");
      }
      const pageSize = 20;
      const result = await userModel.list({ search: search.trim(), skip: (Number(page) - 1) * pageSize, take: pageSize });
      return { ...result, page: Number(page), pageSize };
    },

    async updateProfile(actor, id, { username, email }) {
      const error = validateUsername(username) || validateEmail(email);
      if (error) throw new HttpError(400, error);
      const cleanEmail = normalizedEmail(email);
      if (userModel.isAdminEmail(cleanEmail)) {
        throw new HttpError(403, "An administrator email cannot be assigned from this panel.");
      }

      let updatedUser;
      let emailChanged = false;
      try {
        updatedUser = await withTransaction(async ({ userModel: users, sessionModel: sessions, emailVerificationModel: tokens }) => {
          const user = await manageableUser(users, id, actor);
          emailChanged = cleanEmail !== user.email;
          const updated = await users.updateProfile(user.id, {
            username: normalizedUsername(username),
            email: cleanEmail,
            emailVerifiedAt: emailChanged ? null : user.emailVerifiedAt,
          });
          if (emailChanged) {
            await sessions.deleteByUserId(user.id);
            await tokens.deleteByUserId(user.id);
          }
          return updated;
        });
      } catch (error) {
        if (isUniqueConstraint(error)) throw new HttpError(409, "That username or email is already in use.");
        throw error;
      }
      if (emailChanged) {
        try {
          await emailVerificationService.send(updatedUser);
        } catch (error) {
          console.error("Could not send confirmation after admin profile update", error);
          return { user: updatedUser, warning: "Profile updated, but the confirmation email could not be sent. Use Resend confirmation to retry." };
        }
      }
      return { user: updatedUser };
    },

    async resendVerification(actor, id) {
      const user = await manageableUser(userModel, id, actor);
      if (user.emailVerifiedAt) throw new HttpError(400, "This email address is already confirmed.");
      await emailVerificationService.send(user);
    },

    async confirmEmail(actor, id, email) {
      const error = validateEmail(email);
      if (error) throw new HttpError(400, error);
      return withTransaction(async ({ userModel: users, emailVerificationModel: tokens }) => {
        const user = await manageableUser(users, id, actor);
        if (user.email !== normalizedEmail(email)) {
          throw new HttpError(409, "The email address has changed. Reload the list before confirming it.");
        }
        await tokens.deleteByUserId(user.id);
        return user.emailVerifiedAt ? user : users.markEmailVerified(user.id);
      });
    },

    async deleteUser(actor, id) {
      await withTransaction(async ({ userModel: users }) => {
        const user = await manageableUser(users, id, actor);
        await users.deleteById(user.id);
      });
    },

    async setSuspended(actor, id, suspended) {
      if (typeof suspended !== "boolean") throw new HttpError(400, "Suspended must be a boolean.");
      return withTransaction(async ({ userModel: users, sessionModel: sessions }) => {
        const user = await manageableUser(users, id, actor);
        const updated = await users.setSuspended(user.id, suspended);
        if (suspended) await sessions.deleteByUserId(user.id);
        return updated;
      });
    },
  };
}
