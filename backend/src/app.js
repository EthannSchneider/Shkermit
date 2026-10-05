import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { createAccountController } from "./controllers/account.controller.js";
import { createAuthController } from "./controllers/auth.controller.js";
import { createAuthenticationMiddleware } from "./middleware/authenticate.js";
import { createAuthRateLimit } from "./middleware/auth-rate-limit.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createSessionModel } from "./models/session.model.js";
import { createUserModel } from "./models/user.model.js";
import { createAccountRouter } from "./routes/account.routes.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import { createHealthRouter } from "./routes/health.routes.js";
import { createAccountService } from "./services/account.service.js";
import { createAuthService } from "./services/auth.service.js";
import { createSessionService, sessionCookieOptions } from "./services/session.service.js";

export function createApp({ db, sessionTtlMs, isProduction = false }) {
  const app = express();

  const userModel = createUserModel(db);
  const sessionModel = createSessionModel(db);
  const sessionService = createSessionService({ sessionModel, sessionTtlMs });
  const authService = createAuthService({ userModel, sessionService });
  const withTransaction = (work) =>
    db.$transaction((transaction) =>
      work({
        userModel: createUserModel(transaction),
        sessionModel: createSessionModel(transaction),
      }),
    );
  const accountService = createAccountService({ userModel, sessionService, withTransaction });
  const cookieOptions = sessionCookieOptions(sessionTtlMs, isProduction);
  const authRateLimit = createAuthRateLimit(isProduction);
  const requireAuth = createAuthenticationMiddleware({ sessionService, userModel });
  const authController = createAuthController({ authService, cookieOptions });
  const accountController = createAccountController({ accountService, cookieOptions });

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "20kb" }));
  app.use(cookieParser());

  app.use("/api/health", createHealthRouter());
  app.use(
    "/api/auth",
    createAuthRouter({ controller: authController, authRateLimit, requireAuth }),
  );
  app.use(
    "/api/account",
    createAccountRouter({ controller: accountController, authRateLimit, requireAuth }),
  );

  app.use(errorHandler);
  return app;
}
