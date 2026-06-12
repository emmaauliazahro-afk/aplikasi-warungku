import { Request, Response, NextFunction } from 'express';
import { ApiError } from './error';
import { env } from '../config/env';

/**
 * Lightweight CSRF / cross-origin defense for cookie-authenticated, state-
 * changing requests. Validates the `Origin` header against the configured
 * `WEB_ORIGIN`. Safe methods (GET/HEAD/OPTIONS) are allowed through.
 *
 * This complements `sameSite=lax` cookies: it protects API endpoints that
 * accept JSON but no CSRF token, and works for non-browser clients that
 * happen to know the cookie value.
 */
export function originCheck(req: Request, _res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  // Same-origin requests and direct server-to-server calls don't always send
  // Origin. Allow when there's no Origin header (e.g. mobile app, curl with
  // bearer-only auth). Cookie-authenticated browser requests always include
  // Origin/Referer per the Fetch spec.
  const origin = req.header('origin');
  if (!origin) {
    return next();
  }
  if (origin !== env.webOrigin) {
    throw new ApiError(403, 'Origin tidak diizinkan.');
  }
  next();
}
