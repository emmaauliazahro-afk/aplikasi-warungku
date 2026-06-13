import { z } from 'zod';

export const updateSettingsSchema = z.object({
  storeName: z.string().min(2).max(100),
  ownerName: z.string().min(2).max(100),
  ownerEmail: z.string().email(),
});

export const createCashierFromSettingsSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Za-z]/, 'Password harus mengandung huruf').regex(/\d/, 'Password harus mengandung angka'),
});
