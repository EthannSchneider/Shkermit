import bcrypt from "bcryptjs";
import { PASSWORD_HASH_ROUNDS } from "../config/security.js";
import { HttpError } from "../utils/http-error.js";
import { isUniqueConstraint } from "../utils/sqlite-errors.js";
import {
  normalizedEmail,
  normalizedUsername,
  validateEmail,
  validatePassword,
  validateUsername,
} from "../utils/validation.js";

export function createAccountService({ userModel, sessionService, withTransaction }) {
  return {
    async updateProfile(user, { username = user.username, email = user.email }) {
      const error = validateUsername(username) || validateEmail(email);
      if (error) throw new HttpError(400, error);

      try {
        return await userModel.updateProfile(user.id, {
          username: normalizedUsername(username),
          email: normalizedEmail(email),
        });
      } catch (databaseError) {
        if (isUniqueConstraint(databaseError)) {
          throw new HttpError(409, "That username or email is already in use.");
        }
        throw databaseError;
      }
    },

    async updatePassword(user, { currentPassword, newPassword }) {
      if (!(await bcrypt.compare(currentPassword ?? "", user.passwordHash))) {
        throw new HttpError(401, "Current password is incorrect.");
      }
      const error = validatePassword(newPassword);
      if (error) throw new HttpError(400, error);
      if (currentPassword === newPassword) {
        throw new HttpError(400, "New password must be different from the current password.");
      }

      const passwordHash = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS);
      await withTransaction(async ({ userModel: transactionUsers, sessionModel: transactionSessions }) => {
        await transactionUsers.updatePassword(user.id, passwordHash);
        await transactionSessions.deleteByUserId(user.id);
      });
      return sessionService.create(user.id);
    },

    async deleteAccount(user, password) {
      if (!(await bcrypt.compare(password ?? "", user.passwordHash))) {
        throw new HttpError(401, "Password is incorrect.");
      }
      await userModel.deleteById(user.id);
    },
  };
}
