import { ApiError } from '../middleware/error';
import type { DebtStatus } from '../generated/prisma/client';

export type AdjustMode = 'SET' | 'ADD' | 'SUBTRACT';

/**
 * Format a transaction number as TRX-YYYYMMDD-XXXX.
 * @param date  the transaction date
 * @param seq   the 1-based daily sequence number
 */
export function formatTransactionNumber(date: Date, seq: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `TRX-${y}${m}${d}-${String(seq).padStart(4, '0')}`;
}

/**
 * Derive a debt's remaining amount and status from its total and paid amount.
 */
export function computeDebtFields(
  amount: number,
  paidAmount: number
): { remaining: number; status: DebtStatus } {
  const remaining = amount - paidAmount;
  let status: DebtStatus;
  if (remaining <= 0) status = 'PAID';
  else if (paidAmount > 0) status = 'PARTIAL';
  else status = 'UNPAID';
  return { remaining: Math.max(0, remaining), status };
}

/**
 * Validate a cash payment and return the change. Throws if underpaid.
 */
export function computeCashChange(total: number, paid: number): number {
  if (paid < total) {
    throw new ApiError(400, 'Jumlah bayar kurang dari total');
  }
  return paid - total;
}

/**
 * Compute the resulting stock for an adjustment. Throws if the result is negative.
 */
export function applyStockAdjustment(
  currentStock: number,
  mode: AdjustMode,
  amount: number
): number {
  let next: number;
  if (mode === 'SET') next = amount;
  else if (mode === 'ADD') next = currentStock + amount;
  else next = currentStock - amount;

  if (next < 0) {
    throw new ApiError(400, 'Stok hasil penyesuaian tidak boleh negatif');
  }
  return next;
}

/**
 * Compute total profit from a set of sold line items.
 * profit = sum((price - costPrice) * quantity)
 */
export function calcProfit(
  items: { price: number; costPrice: number; quantity: number }[]
): number {
  return items.reduce((sum, i) => sum + (i.price - i.costPrice) * i.quantity, 0);
}

/**
 * Validate a discount does not exceed the subtotal and return the total.
 */
export function computeTotal(subtotal: number, discount: number): number {
  if (discount > subtotal) {
    throw new ApiError(400, 'Diskon tidak boleh melebihi subtotal');
  }
  return subtotal - discount;
}
