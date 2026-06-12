import { z } from 'zod';

// Password complexity: at least 8 chars, with a letter and a digit.
// Strong enough to deter trivial brute force while staying usable for UMKM.
const passwordSchema = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .max(128, 'Password maksimal 128 karakter')
  .regex(/[A-Za-z]/, 'Password harus mengandung huruf')
  .regex(/[0-9]/, 'Password harus mengandung angka');

const nameSchema = z
  .string()
  .trim()
  .min(2, 'Nama minimal 2 karakter')
  .max(100, 'Nama maksimal 100 karakter');

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Email tidak valid')
  .max(254, 'Email maksimal 254 karakter');

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const createCashierSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password wajib diisi').max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateCashierInput = z.infer<typeof createCashierSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
