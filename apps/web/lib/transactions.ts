import { apiFetch } from './api';

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'DEBT';
export type TransactionStatus = 'COMPLETED' | 'CANCELLED';

export interface TransactionItem {
  id: number;
  productId: number | null;
  productName: string;
  quantity: number;
  price: number;
  costPrice: number;
  subtotal: number;
}

export interface TransactionDebt {
  id: number;
  amount: number;
  paidAmount: number;
  remaining: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  dueDate: string | null;
}

export interface Transaction {
  id: number;
  transactionNumber: string;
  customerId: number | null;
  userId: number | null;
  subtotal: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  note: string | null;
  createdAt: string;
  items?: TransactionItem[];
  customer?: { id: number; name: string } | null;
  debt?: TransactionDebt | null;
  user?: { id: number; name: string } | null;
  _count?: { items: number };
}

export interface CreateTransactionItem {
  productId: number;
  quantity: number;
}

export interface CreateTransactionInput {
  items: CreateTransactionItem[];
  paymentMethod: PaymentMethod;
  discount?: number;
  paidAmount?: number;
  customerId?: number | null;
  note?: string;
  dueDate?: string;
}

export function createTransaction(input: CreateTransactionInput) {
  return apiFetch<Transaction>('/transactions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface TransactionListResult {
  data: Transaction[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export async function listTransactions(params: {
  page?: number;
  limit?: number;
  search?: string;
  paymentMethod?: PaymentMethod;
  startDate?: string;
  endDate?: string;
} = {}): Promise<TransactionListResult> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v));
  });
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';
  const res = await fetch(`${API_URL}/transactions?${qs.toString()}`, {
    credentials: 'include',
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.message ?? 'Gagal memuat transaksi');
  return { data: body.data, meta: body.meta };
}

export function getTransaction(id: number) {
  return apiFetch<Transaction>(`/transactions/${id}`);
}
