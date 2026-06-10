import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { ApiError } from '../middleware/error';

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Nama kategori wajib diisi'),
});

// GET /api/categories
export async function listCategories(_req: Request, res: Response) {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });
  res.json({
    success: true,
    data: categories.map((c) => ({
      id: c.id,
      name: c.name,
      productCount: c._count.products,
    })),
  });
}

// POST /api/categories
export async function createCategory(req: Request, res: Response) {
  const data = categorySchema.parse(req.body);
  const existing = await prisma.category.findUnique({ where: { name: data.name } });
  if (existing) throw new ApiError(409, 'Kategori sudah ada');

  const category = await prisma.category.create({ data });
  res.status(201).json({ success: true, data: category });
}

// PUT /api/categories/:id
export async function updateCategory(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new ApiError(400, 'ID tidak valid');

  const data = categorySchema.parse(req.body);
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'Kategori tidak ditemukan');

  const category = await prisma.category.update({ where: { id }, data });
  res.json({ success: true, data: category });
}

// DELETE /api/categories/:id
export async function deleteCategory(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new ApiError(400, 'ID tidak valid');

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'Kategori tidak ditemukan');

  // Products keep existing but categoryId set null (onDelete: SetNull in schema)
  await prisma.category.delete({ where: { id } });
  res.json({ success: true, message: 'Kategori berhasil dihapus' });
}
