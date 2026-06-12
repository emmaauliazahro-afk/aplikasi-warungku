import { Request, Response } from 'express';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { ApiError } from '../middleware/error';
import { csvRow } from '../utils/csv';

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
  sku: z.string().trim().max(50).optional(),
  name: z.string().trim().min(1, 'Nama wajib diisi').max(150),
  purchasePrice: z.coerce
    .number()
    .min(0, 'Harga beli tidak valid')
    .max(1_000_000_000)
    .default(0),
  sellingPrice: z.coerce
    .number()
    .min(0, 'Harga jual tidak valid')
    .max(1_000_000_000)
    .default(0),
  stock: z.coerce
    .number()
    .int('Stok tidak valid')
    .min(0, 'Stok tidak valid')
    .max(1_000_000)
    .default(0),
  minStock: z.coerce.number().int().min(0).max(1_000_000).default(5),
  unit: z.string().trim().max(20).default('pcs'),
  category: z.string().trim().max(100).optional(),
});

interface FailedRow {
  row: number;
  name?: string;
  message: string;
}

// Defensive cap on a single import. The default 5 MB upload cap yields far
// more than this in practice, but we still want a hard ceiling on rows.
const MAX_IMPORT_ROWS = 1000;

// GET /api/products/import/template
export function downloadTemplate(_req: Request, res: Response) {
  const header = csvRow(CSV_HEADERS);
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
//
// Batched:
//  - we collect per-row parsed data first
//  - we resolve / create categories in a single pass
//  - we issue at most one DB roundtrip for the bulk insert (createMany)
//  - per-row stock-movement rows are also created with createMany
// This replaces the previous per-row $transaction which produced N round
// trips for an N-row file.
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
  if (records.length > MAX_IMPORT_ROWS) {
    throw new ApiError(
      400,
      `Maksimal ${MAX_IMPORT_ROWS} baris per import (file memiliki ${records.length})`
    );
  }

  // Pass 1: parse + validate every row, collect failures.
  type ParsedRow = z.infer<typeof rowSchema> & { _rowNum: number };
  const parsedRows: ParsedRow[] = [];
  const failed: FailedRow[] = [];

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
    parsedRows.push({ ...parsed.data, _rowNum: rowNum });
  }

  // Pass 2: detect SKU collisions (within file + against DB), resolve categories.
  const seenSkus = new Set<string>();
  const existingCategories = await prisma.category.findMany();
  const categoryMap = new Map<string, number>(
    existingCategories.map((c) => [c.name.toLowerCase(), c.id])
  );
  const newCategoryNames: string[] = [];

  type ReadyRow = Omit<ParsedRow, 'sku'> & { sku: string | null; categoryId: number | null };
  const ready: ReadyRow[] = [];

  for (const r of parsedRows) {
    const sku = r.sku && r.sku.length > 0 ? r.sku : null;

    if (sku) {
      const skuLower = sku.toLowerCase();
      if (seenSkus.has(skuLower)) {
        failed.push({ row: r._rowNum, name: r.name, message: `SKU "${sku}" duplikat dalam file` });
        continue;
      }
      seenSkus.add(skuLower);
    }

    let categoryId: number | null = null;
    if (r.category) {
      const key = r.category.toLowerCase();
      const existingId = categoryMap.get(key);
      if (existingId !== undefined) {
        categoryId = existingId;
      } else if (!newCategoryNames.includes(key)) {
        newCategoryNames.push(key);
      }
    }

    ready.push({ ...r, sku, categoryId });
  }

  // Bulk-create missing categories so we can resolve all categoryIds in one shot.
  if (newCategoryNames.length > 0) {
    const nameToOriginal = new Map<string, string>();
    for (const r of ready) {
      if (r.category) nameToOriginal.set(r.category.toLowerCase(), r.category);
    }
    const created = await prisma.category.createMany({
      data: newCategoryNames.map((key) => ({ name: nameToOriginal.get(key) ?? key })),
    });
    // Re-read to capture generated ids.
    const fresh = await prisma.category.findMany({
      where: { name: { in: newCategoryNames.map((k) => nameToOriginal.get(k) ?? k) } },
    });
    for (const c of fresh) categoryMap.set(c.name.toLowerCase(), c.id);
    // `created.count` is just a sanity log; we use the re-read.
    void created;
  }

  // Finalize categoryId resolution.
  for (const r of ready) {
    if (r.categoryId === null && r.category) {
      r.categoryId = categoryMap.get(r.category.toLowerCase()) ?? null;
    }
  }

  // Pass 3: fetch existing SKUs in one query, then filter ready rows further.
  const incomingSkus = ready.map((r) => r.sku).filter((s): s is string => !!s);
  let existingSkus = new Set<string>();
  if (incomingSkus.length > 0) {
    const existing = await prisma.product.findMany({
      where: { sku: { in: incomingSkus } },
      select: { sku: true },
    });
    existingSkus = new Set(existing.map((p) => p.sku as string));
  }

  const toInsert: ReadyRow[] = [];
  for (const r of ready) {
    if (r.sku && existingSkus.has(r.sku)) {
      failed.push({
        row: r._rowNum,
        name: r.name,
        message: `SKU "${r.sku}" sudah ada di database`,
      });
      continue;
    }
    toInsert.push(r);
  }

  if (toInsert.length === 0) {
    return res.json({
      success: true,
      data: {
        totalRows: records.length,
        created: 0,
        failedCount: failed.length,
        failed,
      },
      message: `0 produk berhasil diimpor${failed.length ? `, ${failed.length} gagal` : ''}`,
    });
  }

  // Bulk insert. createMany doesn't return generated ids on Postgres, so we
  // re-query by (sku) to fetch the freshly inserted rows for stock-movement
  // creation. SKUs that were null are matched by name + createdAt window.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.createMany({
        data: toInsert.map((r) => ({
          sku: r.sku,
          name: r.name,
          purchasePrice: r.purchasePrice,
          sellingPrice: r.sellingPrice,
          stock: r.stock,
          minStock: r.minStock,
          unit: r.unit,
          categoryId: r.categoryId,
        })),
      });

      // Fetch the just-created products so we can attach stock-movements.
      // If SKUs are present, use them; otherwise match by name in the set.
      const skus = toInsert.map((r) => r.sku).filter((s): s is string => !!s);
      const names = toInsert.filter((r) => !r.sku).map((r) => r.name);

      const created = await tx.product.findMany({
        where: {
          OR: [
            skus.length ? { sku: { in: skus } } : undefined,
            names.length ? { name: { in: names } } : undefined,
          ].filter(Boolean) as { sku?: { in: string[] }; name?: { in: string[] } }[],
        },
        select: { id: true, sku: true, name: true, stock: true },
      });

      // Build a lookup.
      const bySku = new Map<string, { id: number; stock: number }>();
      const byName = new Map<string, { id: number; stock: number }>();
      for (const p of created) {
        if (p.sku) bySku.set(p.sku, { id: p.id, stock: p.stock });
        else byName.set(p.name, { id: p.id, stock: p.stock });
      }

      const movements = toInsert
        .map((r) => {
          const found = (r.sku ? bySku.get(r.sku) : byName.get(r.name));
          if (!found || r.stock <= 0) return null;
          return {
            productId: found.id,
            type: 'PURCHASE' as const,
            quantity: r.stock,
            stockBefore: 0,
            stockAfter: found.stock,
            note: 'Stok awal (import CSV)',
          };
        })
        .filter((m): m is NonNullable<typeof m> => m !== null);

      if (movements.length > 0) {
        await tx.stockMovement.createMany({ data: movements });
      }
    });
  } catch (err) {
    // If the bulk insert fails (e.g. one row violates a constraint), fall back
    // to per-row insert to preserve the existing "skip on error" UX.
    let created = 0;
    for (const r of toInsert) {
      try {
        await prisma.$transaction(async (tx) => {
          const p = await tx.product.create({
            data: {
              sku: r.sku,
              name: r.name,
              purchasePrice: r.purchasePrice,
              sellingPrice: r.sellingPrice,
              stock: r.stock,
              minStock: r.minStock,
              unit: r.unit,
              categoryId: r.categoryId,
            },
          });
          if (r.stock > 0) {
            await tx.stockMovement.create({
              data: {
                productId: p.id,
                type: 'PURCHASE',
                quantity: r.stock,
                stockBefore: 0,
                stockAfter: r.stock,
                note: 'Stok awal (import CSV)',
              },
            });
          }
        });
        created++;
      } catch {
        failed.push({
          row: r._rowNum,
          name: r.name,
          message: 'Gagal menyimpan ke database',
        });
      }
    }
    return res.json({
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

  res.json({
    success: true,
    data: {
      totalRows: records.length,
      created: toInsert.length,
      failedCount: failed.length,
      failed,
    },
    message: `${toInsert.length} produk berhasil diimpor${failed.length ? `, ${failed.length} gagal` : ''}`,
  });
}
