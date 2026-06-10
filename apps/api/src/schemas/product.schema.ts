import { z } from 'zod';

export const createProductSchema = z.object({
  sku: z.string().trim().min(1).optional().nullable(),
  name: z.string().trim().min(1, 'Nama produk wajib diisi'),
  purchasePrice: z.coerce.number().min(0, 'Harga beli tidak boleh negatif').default(0),
  sellingPrice: z.coerce.number().min(0, 'Harga jual tidak boleh negatif').default(0),
  stock: z.coerce.number().int('Stok harus bilangan bulat').min(0, 'Stok tidak boleh negatif').default(0),
  minStock: z.coerce.number().int().min(0).default(5),
  unit: z.string().trim().min(1).default('pcs'),
  categoryId: z.coerce.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
});

// All fields optional for partial update
export const updateProductSchema = createProductSchema.partial();

export const listProductQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  lowStock: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  sortBy: z.enum(['name', 'stock', 'sellingPrice', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// Stock adjustment: set absolute, or add/subtract a quantity
export const adjustStockSchema = z.object({
  mode: z.enum(['SET', 'ADD', 'SUBTRACT']),
  amount: z.coerce.number().int().min(0, 'Jumlah tidak boleh negatif'),
  note: z.string().trim().optional(),
});

export const movementQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
