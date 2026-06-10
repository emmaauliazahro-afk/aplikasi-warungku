import { Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client';
import prisma from '../lib/prisma';
import { ApiError } from '../middleware/error';
import { serializeTransaction } from '../utils/serialize';
import {
  createTransactionSchema,
  listTransactionQuerySchema,
} from '../schemas/transaction.schema';
import {
  formatTransactionNumber,
  computeTotal,
  computeCashChange,
  computeDebtFields,
} from '../utils/calc';

// Generate TRX-YYYYMMDD-XXXX using a daily counter (within the tx for consistency)
async function generateTransactionNumber(
  tx: Prisma.TransactionClient
): Promise<string> {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const prefix = `TRX-${datePart}`;
  const count = await tx.transaction.count({
    where: { transactionNumber: { startsWith: prefix } },
  });
  return formatTransactionNumber(now, count + 1);
}

// POST /api/transactions
export async function createTransaction(req: Request, res: Response) {
  const data = createTransactionSchema.parse(req.body);

  // Validate customer (if provided)
  if (data.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) throw new ApiError(400, 'Pelanggan tidak ditemukan');
  }

  const result = await prisma.$transaction(async (tx) => {
    // Load all products involved
    const productIds = data.items.map((i) => i.productId);
    const products = await tx.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    const itemsData: Prisma.TransactionItemCreateManyTransactionInput[] = [];
    const stockUpdates: { id: number; before: number; after: number; qty: number }[] = [];

    for (const item of data.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new ApiError(400, `Produk dengan ID ${item.productId} tidak ditemukan`);
      }
      if (!product.isActive) {
        throw new ApiError(400, `Produk "${product.name}" tidak aktif`);
      }
      if (product.stock < item.quantity) {
        throw new ApiError(
          400,
          `Stok "${product.name}" tidak cukup (tersedia ${product.stock}, diminta ${item.quantity})`
        );
      }

      const price = Number(product.sellingPrice.toString());
      const costPrice = Number(product.purchasePrice.toString());
      const lineSubtotal = price * item.quantity;
      subtotal += lineSubtotal;

      itemsData.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        price,
        costPrice,
        subtotal: lineSubtotal,
      });
      stockUpdates.push({
        id: product.id,
        before: product.stock,
        after: product.stock - item.quantity,
        qty: item.quantity,
      });
    }

    const discount = data.discount ?? 0;
    const totalAmount = computeTotal(subtotal, discount);

    // Payment validation
    let paidAmount = data.paidAmount ?? 0;
    let changeAmount = 0;
    if (data.paymentMethod === 'CASH') {
      changeAmount = computeCashChange(totalAmount, paidAmount);
    } else if (data.paymentMethod === 'TRANSFER') {
      paidAmount = totalAmount; // assume exact transfer
    } else if (data.paymentMethod === 'DEBT') {
      // partial down payment allowed; remaining becomes debt
      if (paidAmount > totalAmount) {
        throw new ApiError(400, 'Uang muka tidak boleh melebihi total');
      }
    }

    const transactionNumber = await generateTransactionNumber(tx);

    // Create transaction + items
    const created = await tx.transaction.create({
      data: {
        transactionNumber,
        customerId: data.customerId ?? null,
        userId: req.user?.userId ?? null,
        subtotal,
        discount,
        totalAmount,
        paidAmount,
        changeAmount,
        paymentMethod: data.paymentMethod,
        status: 'COMPLETED',
        note: data.note,
        items: { createMany: { data: itemsData } },
      },
    });

    // Deduct stock + record SALE movements
    for (const su of stockUpdates) {
      await tx.product.update({
        where: { id: su.id },
        data: { stock: su.after },
      });
      await tx.stockMovement.create({
        data: {
          productId: su.id,
          type: 'SALE',
          quantity: -su.qty,
          stockBefore: su.before,
          stockAfter: su.after,
          note: `Penjualan ${transactionNumber}`,
          referenceId: created.id,
        },
      });
    }

    // Create debt record for DEBT payment
    if (data.paymentMethod === 'DEBT') {
      const { remaining, status } = computeDebtFields(totalAmount, paidAmount);
      await tx.debt.create({
        data: {
          customerId: data.customerId!,
          transactionId: created.id,
          amount: totalAmount,
          paidAmount,
          remaining,
          status,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
        },
      });
    }

    // Return full transaction
    return tx.transaction.findUnique({
      where: { id: created.id },
      include: {
        items: true,
        customer: true,
        debt: true,
      },
    });
  });

  res.status(201).json({ success: true, data: serializeTransaction(result) });
}

// GET /api/transactions
export async function listTransactions(req: Request, res: Response) {
  const q = listTransactionQuerySchema.parse(req.query);

  const where: Prisma.TransactionWhereInput = {};
  if (q.search) {
    where.transactionNumber = { contains: q.search, mode: 'insensitive' };
  }
  if (q.paymentMethod) where.paymentMethod = q.paymentMethod;
  if (q.status) where.status = q.status;
  if (q.startDate || q.endDate) {
    where.createdAt = {};
    if (q.startDate) where.createdAt.gte = new Date(q.startDate);
    if (q.endDate) {
      const end = new Date(q.endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: { customer: true, _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
  ]);

  res.json({
    success: true,
    data: transactions.map(serializeTransaction),
    meta: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.ceil(total / q.limit),
    },
  });
}

// GET /api/transactions/:id
export async function getTransaction(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new ApiError(400, 'ID tidak valid');

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      items: true,
      customer: true,
      debt: { include: { payments: true } },
      user: { select: { id: true, name: true } },
    },
  });
  if (!transaction) throw new ApiError(404, 'Transaksi tidak ditemukan');

  res.json({ success: true, data: serializeTransaction(transaction) });
}
