import { Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client';
import prisma from '../lib/prisma';
import { ApiError } from '../middleware/error';
import { serializeProduct } from '../utils/serialize';
import { applyStockAdjustment } from '../utils/calc';
import {
  createProductSchema,
  updateProductSchema,
  listProductQuerySchema,
  adjustStockSchema,
  movementQuerySchema,
} from '../schemas/product.schema';

// GET /api/products
export async function listProducts(req: Request, res: Response) {
  const q = listProductQuerySchema.parse(req.query);

  const where: Prisma.ProductWhereInput = {};

  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { sku: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  if (q.categoryId) {
    where.categoryId = q.categoryId;
  }
  if (q.lowStock) {
    where.stock = { lte: prisma.product.fields.minStock };
  }

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { [q.sortBy]: q.sortOrder },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
  ]);

  res.json({
    success: true,
    data: products.map(serializeProduct),
    meta: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.ceil(total / q.limit),
    },
  });
}

// GET /api/products/:id
export async function getProduct(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new ApiError(400, 'ID tidak valid');

  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!product) throw new ApiError(404, 'Produk tidak ditemukan');

  res.json({ success: true, data: serializeProduct(product) });
}

// POST /api/products
export async function createProduct(req: Request, res: Response) {
  const data = createProductSchema.parse(req.body);

  if (data.sku) {
    const existing = await prisma.product.findUnique({ where: { sku: data.sku } });
    if (existing) throw new ApiError(409, `SKU "${data.sku}" sudah digunakan`);
  }
  if (data.categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!cat) throw new ApiError(400, 'Kategori tidak ditemukan');
  }

  const initialStock = data.stock ?? 0;

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        sku: data.sku ?? null,
        name: data.name,
        purchasePrice: data.purchasePrice,
        sellingPrice: data.sellingPrice,
        stock: initialStock,
        minStock: data.minStock,
        unit: data.unit,
        categoryId: data.categoryId ?? null,
      },
      include: { category: true },
    });

    // Record initial stock as a movement for audit trail
    if (initialStock > 0) {
      await tx.stockMovement.create({
        data: {
          productId: created.id,
          type: 'PURCHASE',
          quantity: initialStock,
          stockBefore: 0,
          stockAfter: initialStock,
          note: 'Stok awal produk',
        },
      });
    }

    return created;
  });

  res.status(201).json({ success: true, data: serializeProduct(product) });
}

// PUT /api/products/:id
export async function updateProduct(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new ApiError(400, 'ID tidak valid');

  const data = updateProductSchema.parse(req.body);

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'Produk tidak ditemukan');

  if (data.sku && data.sku !== existing.sku) {
    const dupe = await prisma.product.findUnique({ where: { sku: data.sku } });
    if (dupe) throw new ApiError(409, `SKU "${data.sku}" sudah digunakan`);
  }
  if (data.categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!cat) throw new ApiError(400, 'Kategori tidak ditemukan');
  }

  // Stock changes via update are tracked as ADJUSTMENT
  const stockChanged = data.stock !== undefined && data.stock !== existing.stock;

  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id },
      data: {
        ...(data.sku !== undefined && { sku: data.sku }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.purchasePrice !== undefined && { purchasePrice: data.purchasePrice }),
        ...(data.sellingPrice !== undefined && { sellingPrice: data.sellingPrice }),
        ...(data.stock !== undefined && { stock: data.stock }),
        ...(data.minStock !== undefined && { minStock: data.minStock }),
        ...(data.unit !== undefined && { unit: data.unit }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: { category: true },
    });

    if (stockChanged) {
      const diff = (data.stock as number) - existing.stock;
      await tx.stockMovement.create({
        data: {
          productId: id,
          type: 'ADJUSTMENT',
          quantity: diff,
          stockBefore: existing.stock,
          stockAfter: data.stock as number,
          note: 'Koreksi stok via edit produk',
        },
      });
    }

    return updated;
  });

  res.json({ success: true, data: serializeProduct(product) });
}

// DELETE /api/products/:id
export async function deleteProduct(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new ApiError(400, 'ID tidak valid');

  const existing = await prisma.product.findUnique({
    where: { id },
    include: { _count: { select: { transactionItems: true } } },
  });
  if (!existing) throw new ApiError(404, 'Produk tidak ditemukan');

  // If product has transaction history, soft-delete (deactivate) to preserve reports
  if (existing._count.transactionItems > 0) {
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    return res.json({
      success: true,
      message: 'Produk memiliki riwayat transaksi, dinonaktifkan (soft delete)',
    });
  }

  await prisma.product.delete({ where: { id } });
  res.json({ success: true, message: 'Produk berhasil dihapus' });
}

// GET /api/products/:id/movements - stock movement history
export async function getStockMovements(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new ApiError(400, 'ID tidak valid');

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new ApiError(404, 'Produk tidak ditemukan');

  const q = movementQuerySchema.parse(req.query);

  const [total, movements] = await Promise.all([
    prisma.stockMovement.count({ where: { productId: id } }),
    prisma.stockMovement.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
  ]);

  res.json({
    success: true,
    data: movements,
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  });
}

// POST /api/products/:id/adjust-stock - manual stock correction (opname / restock)
export async function adjustStock(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new ApiError(400, 'ID tidak valid');

  const data = adjustStockSchema.parse(req.body);

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new ApiError(404, 'Produk tidak ditemukan');

  const newStock = applyStockAdjustment(product.stock, data.mode, data.amount);
  const diff = newStock - product.stock;  // Restock (positive add) recorded as PURCHASE, otherwise ADJUSTMENT
  const movementType = data.mode === 'ADD' ? 'PURCHASE' : 'ADJUSTMENT';

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.product.update({
      where: { id },
      data: { stock: newStock },
      include: { category: true },
    });
    if (diff !== 0) {
      await tx.stockMovement.create({
        data: {
          productId: id,
          type: movementType,
          quantity: diff,
          stockBefore: product.stock,
          stockAfter: newStock,
          note: data.note ?? `Penyesuaian stok manual (${data.mode})`,
        },
      });
    }
    return p;
  });

  res.json({ success: true, data: serializeProduct(updated) });
}
