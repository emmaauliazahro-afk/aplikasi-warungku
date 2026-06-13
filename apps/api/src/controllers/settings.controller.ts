import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { ApiError } from '../middleware/error';
import { updateSettingsSchema, createCashierFromSettingsSchema } from '../schemas/settings.schema';
import { hashPassword } from '../lib/password';

export async function getSettings(req: Request, res: Response) {
  const settings = await prisma.warungSettings.findFirst({
    include: { owner: { select: { id: true, name: true, email: true, role: true, createdAt: true } } },
  });
  if (!settings) {
    throw new ApiError(404, 'Settings belum dibuat');
  }
  res.json({ success: true, data: { settings } });
}

export async function updateSettings(req: Request, res: Response) {
  const data = updateSettingsSchema.parse(req.body);
  const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } });
  if (!owner) throw new ApiError(404, 'Owner tidak ditemukan');

  await prisma.user.update({ where: { id: owner.id }, data: { name: data.ownerName, email: data.ownerEmail } });

  const existing = await prisma.warungSettings.findFirst();
  const settings = existing
    ? await prisma.warungSettings.update({ where: { id: existing.id }, data: { storeName: data.storeName, ownerId: owner.id } })
    : await prisma.warungSettings.create({ data: { storeName: data.storeName, ownerId: owner.id } });

  res.json({ success: true, data: { settings } });
}

export async function createCashierFromSettings(req: Request, res: Response) {
  const data = createCashierFromSettingsSchema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new ApiError(409, 'Email sudah terdaftar');
  const user = await prisma.user.create({ data: { name: data.name, email: data.email, password: await hashPassword(data.password), role: 'CASHIER' }, select: { id: true, name: true, email: true, role: true, createdAt: true } });
  res.status(201).json({ success: true, data: { user } });
}
