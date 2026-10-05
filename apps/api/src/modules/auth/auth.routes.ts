import { Router } from "express";

import {
  getCurrentUserHandler,
  createSocketTokenHandler,
  loginUserHandler,
  logoutUserHandler,
  registerUserHandler,
} from "./auth.controller.js";

import { authRateLimit } from "../../middleware/auth-rate-limit.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

router.post("/register", authRateLimit, registerUserHandler);
router.post("/login", authRateLimit, loginUserHandler);
router.post("/logout", requireAuth, logoutUserHandler);
router.get("/me", requireAuth, getCurrentUserHandler);
router.get("/socket-token", requireAuth, createSocketTokenHandler);

export default router;
