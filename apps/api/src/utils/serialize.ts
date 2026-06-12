import type { Prisma } from '../generated/prisma/client';

// Convert Prisma Decimal (or string/number) to a JS number
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  // Prisma Decimal has toString(); also handles string
  return Number(value.toString());
}

type DecimalLike = { toString(): string } | number | string | null | undefined;

type ProductLike = {
  purchasePrice: DecimalLike;
  sellingPrice: DecimalLike;
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

// Serializers for nested Transaction payloads ----------------------------------
// Rather than using `any`, we type the row as a `Prisma.TransactionGetPayload`
// parameterized over the include shape we use. Two common shapes:
//
//  1) transaction + items + customer + debt
//  2) transaction + items + customer + debt + payments + user

type TxWithItems = Prisma.TransactionGetPayload<{ include: { items: true } }>;
type TxWithItemsCustomerDebt = Prisma.TransactionGetPayload<{
  include: { items: true; customer: true; debt: true };
}>;
type TxWithItemsCustomerDebtPayments = Prisma.TransactionGetPayload<{
  include: {
    items: true;
    customer: true;
    debt: { include: { payments: true } };
    user: { select: { id: true; name: true } };
  };
}>;

type ItemLike = {
  price: DecimalLike;
  costPrice: DecimalLike;
  subtotal: DecimalLike;
  [key: string]: unknown;
};

type DebtLike = {
  amount: DecimalLike;
  paidAmount: DecimalLike;
  remaining: DecimalLike;
  [key: string]: unknown;
};

function serializeItems(items: ItemLike[] | undefined) {
  if (!items) return items;
  return items.map((it) => ({
    ...it,
    price: toNumber(it.price),
    costPrice: toNumber(it.costPrice),
    subtotal: toNumber(it.subtotal),
  }));
}

function serializeDebt(d: DebtLike | null | undefined) {
  if (!d) return d;
  return {
    ...d,
    amount: toNumber(d.amount),
    paidAmount: toNumber(d.paidAmount),
    remaining: toNumber(d.remaining),
  };
}

export function serializeTransaction(
  tx: TxWithItemsCustomerDebtPayments | TxWithItemsCustomerDebt | TxWithItems | null
) {
  if (!tx) return tx;
  return {
    ...tx,
    subtotal: toNumber((tx as { subtotal: DecimalLike }).subtotal),
    discount: toNumber((tx as { discount: DecimalLike }).discount),
    totalAmount: toNumber((tx as { totalAmount: DecimalLike }).totalAmount),
    paidAmount: toNumber((tx as { paidAmount: DecimalLike }).paidAmount),
    changeAmount: toNumber((tx as { changeAmount: DecimalLike }).changeAmount),
    items: serializeItems((tx as { items?: ItemLike[] }).items),
    debt: serializeDebt((tx as { debt?: DebtLike | null }).debt),
  };
}
