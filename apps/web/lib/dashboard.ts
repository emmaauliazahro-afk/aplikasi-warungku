import { apiFetch } from './api';

export interface SalesTrendPoint {
  date: string;
  revenue: number;
}

export interface DashboardStats {
  todayRevenue: number;
  todayTransactions: number;
  lowStockCount: number;
  totalProducts: number;
  totalDebt: number;
  totalCustomers: number;
  salesTrend: SalesTrendPoint[];
}

export function getDashboardStats() {
  return apiFetch<DashboardStats>('/dashboard/stats');
}
