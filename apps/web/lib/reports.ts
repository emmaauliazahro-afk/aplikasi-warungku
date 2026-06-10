const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';

export interface SalesSummary {
  revenue: number;
  discount: number;
  profit: number;
  transactions: number;
}

export interface DailySales {
  date: string;
  revenue: number;
  transactions: number;
  profit: number;
}

export interface SalesTransaction {
  id: number;
  transactionNumber: string;
  createdAt: string;
  totalAmount: number;
  paymentMethod: string;
  customer: string | null;
  itemCount: number;
}

export interface SalesReportData {
  summary: SalesSummary;
  daily: DailySales[];
  transactions: SalesTransaction[];
}

export interface ReportParams {
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
}

export async function getSalesReport(params: ReportParams = {}): Promise<SalesReportData> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) qs.set(k, v);
  });
  const res = await fetch(`${API}/reports/sales?${qs}`, { credentials: 'include' });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.message ?? 'Gagal memuat laporan');
  return body.data;
}

export function getExportUrl(params: ReportParams = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) qs.set(k, v);
  });
  return `${API}/reports/sales/export?${qs}`;
}

export interface TopProduct {
  rank: number;
  productId: number;
  name: string;
  quantity: number;
  revenue: number;
  profit: number;
}

export async function getTopProducts(params: ReportParams & { limit?: number; sortBy?: 'quantity' | 'revenue' } = {}): Promise<TopProduct[]> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) qs.set(k, String(v));
  });
  const res = await fetch(`${API}/reports/top-products?${qs}`, { credentials: 'include' });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.message ?? 'Gagal memuat data');
  return body.data;
}
