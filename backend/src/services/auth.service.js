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

export function createAuthService({ userModel, sessionService }) {
  return {
    async register({ username, email, password }) {
      const error = validateUsername(username) || validateEmail(email) || validatePassword(password);
      if (error) throw new HttpError(400, error);

      const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
      let user;
      try {
        user = await userModel.create({
          username: normalizedUsername(username),
          email: normalizedEmail(email),
          passwordHash,
        });
      } catch (databaseError) {
        if (isUniqueConstraint(databaseError)) {
          throw new HttpError(409, "That username or email is already in use.");
        }
        throw databaseError;
      }

      return { user, token: await sessionService.create(user.id) };
    },

    async login({ identifier, password }) {
      const cleanIdentifier = typeof identifier === "string" ? identifier.trim() : "";
      if (!cleanIdentifier || typeof password !== "string") {
        throw new HttpError(400, "Email or username and password are required.");
      }

      const user = await userModel.findByIdentifier(cleanIdentifier);
      const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
      if (!valid) throw new HttpError(401, "Invalid email, username, or password.");

      return { user, token: await sessionService.create(user.id) };
    },

    logout(token) {
      return sessionService.delete(token);
    },
  };
}
