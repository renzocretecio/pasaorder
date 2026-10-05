import type { Request, Response } from "express";
import {
  getCurrentUser,
  loginUser,
  registerUser,
  logoutUser,
} from "./auth.service.js";
import {
  createSocketToken,
  disconnectOwnerSockets,
} from "../../realtime/socket.js";
export async function registerUserHandler(req: Request, res: Response) {
  res.status(201).json(await registerUser(req.body));
}
export async function loginUserHandler(req: Request, res: Response) {
  res.json(await loginUser(req.body));
}
export async function getCurrentUserHandler(req: Request, res: Response) {
  res.json({ user: await getCurrentUser(req.auth!.userId) });
}

export async function logoutUserHandler(req: Request, res: Response) {
  await logoutUser(req.auth!.userId);
  disconnectOwnerSockets(req.auth!.userId);
  res.status(204).end();
}

export async function createSocketTokenHandler(req: Request, res: Response) {
  res.json({
    token: createSocketToken(req.auth!.userId, req.auth!.tokenVersion),
  });
}
