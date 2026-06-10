import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../lib/jwt';
import { ApiError } from './error';

// Augment Express Request with the authenticated user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function extractToken(req: Request): string | null {
  // 1. httpOnly cookie
  if (req.cookies?.token) {
    return req.cookies.token;
  }
  // 2. Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    throw new ApiError(401, 'Tidak terautentikasi. Silakan login.');
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    throw new ApiError(401, 'Token tidak valid atau kadaluarsa.');
  }
}

// Restrict a route to specific roles
export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'Tidak terautentikasi.');
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      throw new ApiError(403, 'Anda tidak memiliki akses untuk aksi ini.');
    }
    next();
  };
}
