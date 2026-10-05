import { Router } from "express";
import { healthCheck } from "../controllers/health.controller.js";

export function createHealthRouter() {
  const router = Router();
  router.get("/", healthCheck);
  return router;
}
