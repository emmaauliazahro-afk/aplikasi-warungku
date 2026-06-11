import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { hashPassword, comparePassword } from '../lib/password';
import { signToken } from '../lib/jwt';
import { ApiError } from '../middleware/error';
import { createCashierSchema, registerSchema, loginSchema } from '../schemas/auth.schema';
import { env } from '../config/env';

const COOKIE_NAME = 'token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function register(req: Request, res: Response) {
  const data = registerSchema.parse(req.body);

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

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: await hashPassword(data.password),
      role: 'OWNER',
    },
    select: { id: true, name: true, email: true, role: true },
  });

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  setAuthCookie(res, token);

  res.status(201).json({ success: true, data: { user, token } });
}

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
      role: 'CASHIER',
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  res.status(201).json({ success: true, data: { user } });
}

export async function login(req: Request, res: Response) {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (!user) {
    throw new ApiError(401, 'Email atau password salah');
  }

  const valid = await comparePassword(data.password, user.password);
  if (!valid) {
    throw new ApiError(401, 'Email atau password salah');
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  setAuthCookie(res, token);

  res.json({
    success: true,
    data: {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token,
    },
  });
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  if (!user) {
    throw new ApiError(404, 'User tidak ditemukan');
  }
  res.json({ success: true, data: { user } });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME);
  res.json({ success: true, message: 'Berhasil logout' });
}
