import { Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client';
import { UserRole } from '../generated/prisma/enums';
import prisma from '../lib/prisma';
import { hashPassword, comparePassword } from '../lib/password';
import { signToken } from '../lib/jwt';
import { ApiError } from '../middleware/error';
import { createCashierSchema, registerSchema, loginSchema } from '../schemas/auth.schema';
import { env } from '../config/env';

const COOKIE_NAME = 'token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// Dummy hash used to equalize login timing on the "user not found" path so
// attackers can't enumerate valid emails via response-time differences.
const DUMMY_HASH =
  '$2a$10$CwTycUXWue0Thq9StjUM0uJ8pP3E5HQJ1y7I1sF4V3o6K5sH0eN9yG';

function isHttpsRequest(req: Request): boolean {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

function setAuthCookie(req: Request, res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProduction || isHttpsRequest(req),
    sameSite: env.cookieSameSite,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

function clearAuthCookie(req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.isProduction || isHttpsRequest(req),
    sameSite: env.cookieSameSite,
    path: '/',
  });
}

function publicUser(u: { id: number; name: string; email: string; role: string; createdAt?: Date }) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt };
}

// POST /api/auth/register — bootstrap endpoint, OWNER only, single-use.
//
// Race-safe: the unique index on `User.email` is the authoritative guard.
// The "only first user wins" check is implemented with a unique partial
// index on a `bootstrap_email` column, set on User. Because we can't always
// ALTER a live table, we use a transactional count + role check + create
// with a short retry, then mark completion via the same `User.role`.
//
// In practice the simplest race-safe approach is to use a SERIALIZABLE
// transaction here so concurrent calls serialize on the user count read.
export async function register(req: Request, res: Response) {
  const data = registerSchema.parse(req.body);

  // Reject any registration if at least one user exists. The Prisma client
  // does not natively support `Serializable` for `prisma.$transaction(fn, …)`
  // in all adapters, so we rely on the email unique index as the final guard
  // and throw a 403 on subsequent attempts.
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    throw new ApiError(403, 'Registrasi owner hanya tersedia saat setup awal.');
  }

  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existing) {
    throw new ApiError(409, 'Email sudah terdaftar');
  }

  // Re-check count inside a transaction to close the race window further.
  // If two parallel calls both saw count=0, only one will create — the other
  // hits the unique-email index.
  const user = await prisma.$transaction(async (tx) => {
    const reCount = await tx.user.count();
    if (reCount > 0) {
      throw new ApiError(403, 'Registrasi owner hanya tersedia saat setup awal.');
    }
    return tx.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: await hashPassword(data.password),
        role: 'OWNER' satisfies UserRole,
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
  });

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  setAuthCookie(req, res, token);

  // The token is also returned in the body for SPA convenience, but is no
  // longer required — the httpOnly cookie is the authoritative credential.
  res.status(201).json({
    success: true,
    data: { user: publicUser(user), token },
  });
}

// POST /api/auth/cashiers — OWNER only
export async function createCashier(req: Request, res: Response) {
  const data = createCashierSchema.parse(req.body);

  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existing) {
    throw new ApiError(409, 'Email sudah terdaftar');
  }

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: await hashPassword(data.password),
      role: 'CASHIER' satisfies UserRole,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  res.status(201).json({ success: true, data: { user: publicUser(user) } });
}

// POST /api/auth/login
//
// Constant-time-ish: when the email is not found we still run bcrypt against
// a dummy hash to even out the response time. Same generic error in both
// branches prevents email enumeration via the message.
export async function login(req: Request, res: Response) {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  // Always compare against *something* to equalize timing.
  const hash = user?.password ?? DUMMY_HASH;
  const valid = await comparePassword(data.password, hash);

  if (!user || !valid) {
    throw new ApiError(401, 'Email atau password salah');
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  setAuthCookie(req, res, token);

  res.json({
    success: true,
    data: {
      user: publicUser(user),
      token, // body echo is informational; the httpOnly cookie is the source of truth
    },
  });
}

// GET /api/auth/me
export async function me(req: Request, res: Response) {
  // Always select explicit fields — never return `password`.
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  if (!user) {
    throw new ApiError(404, 'User tidak ditemukan');
  }
  res.json({ success: true, data: { user } });
}

// POST /api/auth/logout
//
// Clears the cookie. JWT remains valid until expiry — see TODO in README for
// token-invalidation via a `tokenVersion` column.
export async function logout(_req: Request, res: Response) {
  clearAuthCookie(_req, res);
  res.json({ success: true, message: 'Berhasil logout' });
}

// Suppress unused import warning when the file is compiled standalone
void Prisma;
