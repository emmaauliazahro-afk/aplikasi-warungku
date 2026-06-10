import { Request, Response } from 'express';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { ApiError } from '../middleware/error';

// CSV template header (order matters for the downloadable template)
export const CSV_HEADERS = [
  'sku',
  'name',
  'purchasePrice',
  'sellingPrice',
  'stock',
  'minStock',
  'unit',
  'category',
];

const rowSchema = z.object({
  sku: z.string().trim().optional(),
  name: z.string().trim().min(1, 'Nama wajib diisi'),
  purchasePrice: z.coerce.number().min(0, 'Harga beli tidak valid').default(0),
  sellingPrice: z.coerce.number().min(0, 'Harga jual tidak valid').default(0),
  stock: z.coerce.number().int().min(0, 'Stok tidak valid').default(0),
  minStock: z.coerce.number().int().min(0).default(5),
  unit: z.string().trim().default('pcs'),
  category: z.string().trim().optional(),
});

interface FailedRow {
  row: number;
  name?: string;
  message: string;
}

// GET /api/products/import/template
export function downloadTemplate(_req: Request, res: Response) {
  const header = CSV_HEADERS.join(',');
  const example = [
    'BRS-001,Beras Premium 5kg,60000,68000,50,10,karung,Sembako',
    'MYK-001,Minyak Goreng 1L,14000,17000,40,10,botol,Sembako',
    ',Permen Mint,500,1000,100,20,pcs,Makanan Ringan',
  ];
  const csv = [header, ...example].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="template-produk.csv"');
  res.send(csv);
}

// POST /api/products/import
export async function importProducts(req: Request, res: Response) {
  if (!req.file) {
    throw new ApiError(400, 'File CSV wajib diunggah');
  }

  let records: Record<string, string>[];
  try {
    records = parse(req.file.buffer.toString('utf-8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch {
    throw new ApiError(400, 'Format CSV tidak valid');
  }

  if (records.length === 0) {
    throw new ApiError(400, 'File CSV kosong');
  }

  // Preload existing categories (lowercased name -> id)
  const existingCategories = await prisma.category.findMany();
  const categoryMap = new Map<string, number>(
    existingCategories.map((c) => [c.name.toLowerCase(), c.id])
  );

  // Track SKUs seen within this file to detect intra-file duplicates
  const seenSkus = new Set<string>();
  const failed: FailedRow[] = [];
  let created = 0;

  for (let i = 0; i < records.length; i++) {
    const rowNum = i + 2; // +1 for header, +1 for 1-based
    const parsed = rowSchema.safeParse(records[i]);

    if (!parsed.success) {
      failed.push({
        row: rowNum,
        name: records[i].name,
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
      continue;
    }

    const data = parsed.data;
    const sku = data.sku && data.sku.length > 0 ? data.sku : null;

    try {
      // Duplicate SKU checks (within file + DB)
      if (sku) {
        if (seenSkus.has(sku.toLowerCase())) {
          failed.push({ row: rowNum, name: data.name, message: `SKU "${sku}" duplikat dalam file` });
          continue;
        }
        const existing = await prisma.product.findUnique({ where: { sku } });
        if (existing) {
          failed.push({ row: rowNum, name: data.name, message: `SKU "${sku}" sudah ada di database` });
          continue;
        }
        seenSkus.add(sku.toLowerCase());
      }

      // Resolve / create category
      let categoryId: number | null = null;
      if (data.category) {
        const key = data.category.toLowerCase();
        if (categoryMap.has(key)) {
          categoryId = categoryMap.get(key)!;
        } else {
          const newCat = await prisma.category.create({ data: { name: data.category } });
          categoryMap.set(key, newCat.id);
          categoryId = newCat.id;
        }
      }

      await prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            sku,
            name: data.name,
            purchasePrice: data.purchasePrice,
            sellingPrice: data.sellingPrice,
            stock: data.stock,
            minStock: data.minStock,
            unit: data.unit,
            categoryId,
          },
        });
        if (data.stock > 0) {
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              type: 'PURCHASE',
              quantity: data.stock,
              stockBefore: 0,
              stockAfter: data.stock,
              note: 'Stok awal (import CSV)',
            },
          });
        }
      });
      created++;
    } catch {
      failed.push({ row: rowNum, name: data.name, message: 'Gagal menyimpan ke database' });
    }
  }

  res.json({
    success: true,
    data: {
      totalRows: records.length,
      created,
      failedCount: failed.length,
      failed,
    },
    message: `${created} produk berhasil diimpor${failed.length ? `, ${failed.length} gagal` : ''}`,
  });
}
