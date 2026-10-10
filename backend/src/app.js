import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import { createAdminUserController } from "./controllers/admin-user.controller.js";
import { createAdminUserRouter } from "./routes/admin-user.routes.js";
import { createAdminUserService } from "./services/admin-user.service.js";
import { createAccountController } from "./controllers/account.controller.js";
import { createAuthController } from "./controllers/auth.controller.js";
import { createPictureController } from "./controllers/picture.controller.js";
import { createGameScoreController } from "./controllers/game-score.controller.js";
import { createAuthenticationMiddleware } from "./middleware/authenticate.js";
import { createAuthRateLimit } from "./middleware/auth-rate-limit.js";
import { requireAdmin } from "./middleware/require-admin.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createSessionModel } from "./models/session.model.js";
import { createEmailVerificationModel } from "./models/email-verification.model.js";
import { createUserModel } from "./models/user.model.js";
import { createPictureModel } from "./models/picture.model.js";
import { createGameScoreModel } from "./models/game-score.model.js";
import { createAccountRouter } from "./routes/account.routes.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import { createHealthRouter } from "./routes/health.routes.js";
import { createPictureRouter } from "./routes/picture.routes.js";
import { createGameScoreRouter } from "./routes/game-score.routes.js";
import { createAccountService } from "./services/account.service.js";
import { createAuthService } from "./services/auth.service.js";
import { createSessionService, sessionCookieOptions } from "./services/session.service.js";
import { createEmailVerificationService } from "./services/email-verification.service.js";
import { createPictureService } from "./services/picture.service.js";
import { createGameScoreService } from "./services/game-score.service.js";
import { createPictureStorage } from "./services/picture-storage.service.js";

export function createApp({
  db,
  sessionTtlMs,
  emailVerificationTtlMs,
  appUrl,
  mailer,
  adminEmails = [],
  pictureUploadDirectory = "data/files/pictures",
  frontendDirectory = null,
  isProduction = false,
}) {
  const app = express();

  const userModel = createUserModel(db, { adminEmails });
  const sessionModel = createSessionModel(db);
  const emailVerificationModel = createEmailVerificationModel(db);
  const pictureModel = createPictureModel(db);
  const gameScoreModel = createGameScoreModel(db);
  const pictureStorage = createPictureStorage(pictureUploadDirectory);
  const sessionService = createSessionService({ sessionModel, sessionTtlMs });
  const withTransaction = (work) =>
    db.$transaction((transaction) =>
      work({
        userModel: createUserModel(transaction, { adminEmails }),
        sessionModel: createSessionModel(transaction),
        emailVerificationModel: createEmailVerificationModel(transaction),
      }),
    );
  const emailVerificationService = createEmailVerificationService({
    userModel,
    emailVerificationModel,
    mailer,
    withTransaction,
    appUrl,
    tokenTtlMs: emailVerificationTtlMs,
  });
  const authService = createAuthService({
    userModel,
    sessionService,
    emailVerificationService,
  });
  const accountService = createAccountService({
    userModel,
    sessionService,
    emailVerificationService,
    withTransaction,
  });
  const pictureService = createPictureService({ pictureModel, pictureStorage });
  const adminUserService = createAdminUserService({ userModel, emailVerificationService, withTransaction });
  const gameScoreService = createGameScoreService({ gameScoreModel });
  const cookieOptions = sessionCookieOptions(sessionTtlMs, isProduction);
  const authRateLimit = createAuthRateLimit(isProduction);
  const requireAuth = createAuthenticationMiddleware({ sessionService, userModel });
  const authController = createAuthController({ authService, cookieOptions });
  const accountController = createAccountController({ accountService, cookieOptions });
  const pictureController = createPictureController({ pictureService });
  const gameScoreController = createGameScoreController({ gameScoreService });
  const adminUserController = createAdminUserController({ adminUserService });

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "20kb" }));
  app.use(cookieParser());
  app.use("/api/picture-assets", express.static(path.join(pictureUploadDirectory, "builtin"), {
    immutable: true,
    maxAge: "1y",
  }));

  app.use("/api/health", createHealthRouter());
  app.use("/api/admin/users", createAdminUserRouter({
    controller: adminUserController, requireAuth, requireAdmin, authRateLimit,
  }));
  app.use(
    "/api/auth",
    createAuthRouter({ controller: authController, authRateLimit, requireAuth }),
  );
  app.use(
    "/api/account",
    createAccountRouter({ controller: accountController, authRateLimit, requireAuth }),
  );
  app.use(
    "/api/pictures",
    createPictureRouter({ controller: pictureController, requireAuth, requireAdmin }),
  );
  app.use(
    "/api/scores",
    createGameScoreRouter({ controller: gameScoreController, requireAuth }),
  );

  if (frontendDirectory) {
    app.use(express.static(frontendDirectory));
    app.get(/^(?!\/api(?:\/|$)).*/, (_request, response, next) => {
      response.sendFile(path.join(frontendDirectory, "index.html"), (error) => {
        if (error) next(error);
      });
    });
  }

  app.use(errorHandler);
  return app;
}
