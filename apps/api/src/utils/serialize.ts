// Convert Prisma Decimal (or string/number) to a JS number
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  // Prisma Decimal has toString(); also handles string
  return Number(value.toString());
}

type ProductLike = {
  purchasePrice: unknown;
  sellingPrice: unknown;
  [key: string]: unknown;
};

// Serialize a product: convert Decimal price fields to numbers
export function serializeProduct<T extends ProductLike>(product: T) {
  return {
    ...product,
    purchasePrice: toNumber(product.purchasePrice),
    sellingPrice: toNumber(product.sellingPrice),
  };
}

// Serialize a transaction (and nested items) Decimal fields to numbers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeTransaction(tx: any) {
  if (!tx) return tx;
  return {
    ...tx,
    subtotal: toNumber(tx.subtotal),
    discount: toNumber(tx.discount),
    totalAmount: toNumber(tx.totalAmount),
    paidAmount: toNumber(tx.paidAmount),
    changeAmount: toNumber(tx.changeAmount),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: tx.items?.map((it: any) => ({
      ...it,
      price: toNumber(it.price),
      costPrice: toNumber(it.costPrice),
      subtotal: toNumber(it.subtotal),
    })),
    debt: tx.debt
      ? {
          ...tx.debt,
          amount: toNumber(tx.debt.amount),
          paidAmount: toNumber(tx.debt.paidAmount),
          remaining: toNumber(tx.debt.remaining),
        }
      : tx.debt,
  };
}
