import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { queryOne } from "../db.js";

let io: Server | undefined;

export function createSocketToken(userId: string, tokenVersion: number) {
  return jwt.sign(
    { version: tokenVersion, scope: "orders:read" },
    env.JWT_SECRET,
    {
      subject: userId,
      algorithm: "HS256",
      issuer: "pasaorder",
      audience: "pasaorder-realtime",
      expiresIn: "5m",
    },
  );
}

export function initRealtime(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: env.WEB_ORIGIN, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const trackingToken = socket.handshake.auth?.trackingToken;
      if (
        typeof trackingToken === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          trackingToken,
        )
      ) {
        const order = await queryOne<{ id: string }>(
          `SELECT id FROM orders WHERE tracking_token = $1`,
          [trackingToken],
        );
        if (!order) throw new Error("Order not found");
        socket.data.trackingToken = trackingToken;
        next();
        return;
      }

      const token = socket.handshake.auth?.token;
      if (typeof token !== "string") throw new Error("Missing token");
      const payload = jwt.verify(token, env.JWT_SECRET, {
        algorithms: ["HS256"],
        issuer: "pasaorder",
        audience: "pasaorder-realtime",
      });
      if (
        typeof payload === "string" ||
        typeof payload.sub !== "string" ||
        !/^[1-9]\d*$/.test(payload.sub) ||
        !Number.isInteger(payload.version) ||
        payload.scope !== "orders:read"
      )
        throw new Error("Invalid token");
      const user = await queryOne<{ tokenVersion: number }>(
        `SELECT token_version AS "tokenVersion" FROM users WHERE id = $1`,
        [payload.sub],
      );
      if (!user || user.tokenVersion !== payload.version)
        throw new Error("Session expired");
      socket.data.userId = payload.sub;
      socket.data.tokenExpiresAt = payload.exp;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const trackingToken = socket.data.trackingToken as string | undefined;
    if (trackingToken) {
      socket.join(`customer-order:${trackingToken}`);
      return;
    }

    const ownerRoom = `owner:${socket.data.userId}`;
    socket.join(ownerRoom);
    const expiry = socket.data.tokenExpiresAt as number | undefined;
    const expiryTimer = expiry
      ? setTimeout(
          () => socket.disconnect(true),
          Math.max(0, expiry * 1000 - Date.now()),
        )
      : undefined;
    expiryTimer?.unref();
    socket.on("disconnect", () => expiryTimer && clearTimeout(expiryTimer));

    socket.on(
      "store:join",
      async (
        input: unknown,
        acknowledge?: (result: { ok: boolean }) => void,
      ) => {
        try {
          const storeId =
            input && typeof input === "object" && "storeId" in input
              ? String(input.storeId)
              : "";
          if (!/^[1-9]\d*$/.test(storeId)) throw new Error("Invalid store");
          const store = await queryOne<{ id: string }>(
            `SELECT id FROM stores WHERE id = $1 AND owner_id = $2`,
            [storeId, socket.data.userId],
          );
          if (!store) throw new Error("Store access denied");
          await socket.join(`store:${storeId}`);
          acknowledge?.({ ok: true });
        } catch {
          acknowledge?.({ ok: false });
        }
      },
    );
  });
  return io;
}

export function emitOrdersChanged(storeId: string) {
  io?.to(`store:${storeId}`).emit("orders:changed", { storeId });
}

export function emitCustomerOrderChanged(trackingToken: string) {
  io?.to(`customer-order:${trackingToken}`).emit("customer:order-changed");
}

export function disconnectOwnerSockets(userId: string) {
  io?.in(`owner:${userId}`).disconnectSockets(true);
}
