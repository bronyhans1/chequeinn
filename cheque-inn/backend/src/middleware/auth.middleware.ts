import { Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { ENV } from "../config/env";
import { AuthenticatedRequest } from "../types/auth";
import { isLikelyTransientNetworkError, sleepMs } from "../lib/transientNetworkError";

const supabase = createClient(
  ENV.SUPABASE_URL,
  ENV.SUPABASE_ANON_KEY
);

const AUTH_GET_USER_ATTEMPTS = 3;

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];

  for (let attempt = 1; attempt <= AUTH_GET_USER_ATTEMPTS; attempt++) {
    try {
      const { data, error } = await supabase.auth.getUser(token);

      if (!error && data.user) {
        req.user = {
          id: data.user.id,
          email: data.user.email,
        };
        next();
        return;
      }

      const msgErr =
        error && typeof error === "object" && "message" in error
          ? (error as { message?: string }).message
          : error;
      const transient =
        isLikelyTransientNetworkError(error) || isLikelyTransientNetworkError(msgErr);

      if (attempt < AUTH_GET_USER_ATTEMPTS && transient) {
        console.warn(
          `authMiddleware: getUser transient failure (attempt ${attempt}/${AUTH_GET_USER_ATTEMPTS})`,
          error
        );
        await sleepMs(200 * attempt);
        continue;
      }

      if (transient) {
        return res.status(503).json({ error: "Authentication service temporarily unavailable" });
      }

      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    } catch (err) {
      const transient = isLikelyTransientNetworkError(err);
      if (attempt < AUTH_GET_USER_ATTEMPTS && transient) {
        console.warn(
          `authMiddleware: getUser threw transient error (attempt ${attempt}/${AUTH_GET_USER_ATTEMPTS})`,
          err
        );
        await sleepMs(200 * attempt);
        continue;
      }
      console.error("authMiddleware error", err);
      if (transient) {
        return res.status(503).json({ error: "Authentication service temporarily unavailable" });
      }
      return res.status(500).json({ error: "Authentication failed" });
    }
  }

  return res.status(503).json({ error: "Authentication service temporarily unavailable" });
};