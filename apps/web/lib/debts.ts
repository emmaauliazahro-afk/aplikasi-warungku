import { apiFetch } from './api';

export type DebtStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface DebtPayment {
  id: number;
  amount: number;
  note: string | null;
  createdAt: string;
}

export interface Debt {
  id: number;
  customerId: number;
  transactionId: number | null;
  amount: number;
  paidAmount: number;
  remaining: number;
  status: DebtStatus;
  dueDate: string | null;
  createdAt: string;
  customer?: { id: number; name: string; phone?: string | null };
  transaction?: { transactionNumber: string } | null;
  payments?: DebtPayment[];
}

export interface DebtListResult {
  data: Debt[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    totalOutstanding: number;
  };
}

export async function listDebts(params: {
  page?: number;
  limit?: number;
  status?: DebtStatus;
  customerId?: number;
} = {}): Promise<DebtListResult> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) qs.set(k, String(v));
  });
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';
  const res = await fetch(`${API_URL}/debts?${qs.toString()}`, { credentials: 'include' });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.message ?? 'Gagal memuat hutang');
  return { data: body.data, meta: body.meta };
}

export function getDebt(id: number) {
  return apiFetch<Debt>(`/debts/${id}`);
}

export function recordPayment(id: number, amount: number, note?: string) {
  return apiFetch<Debt>(`/debts/${id}/payment`, {
    method: 'POST',
    body: JSON.stringify({ amount, note }),
  });
}
