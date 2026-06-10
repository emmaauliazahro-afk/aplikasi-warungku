import { apiFetch } from './api';
import type { Transaction } from './transactions';

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  createdAt?: string;
  totalDebt?: number;
  transactionCount?: number;
}

export interface CustomerDebt {
  id: number;
  amount: number;
  paidAmount: number;
  remaining: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  dueDate: string | null;
  createdAt: string;
}

export interface CustomerDetail extends Customer {
  totalDebt: number;
  transactions: Transaction[];
  debts: CustomerDebt[];
}

export interface CustomerInput {
  name: string;
  phone?: string | null;
  address?: string | null;
}

export function listCustomers(search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiFetch<Customer[]>(`/customers${qs}`);
}

export function getCustomer(id: number) {
  return apiFetch<CustomerDetail>(`/customers/${id}`);
}

export function createCustomer(input: CustomerInput) {
  return apiFetch<Customer>('/customers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateCustomer(id: number, input: Partial<CustomerInput>) {
  return apiFetch<Customer>(`/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteCustomer(id: number) {
  return apiFetch<null>(`/customers/${id}`, { method: 'DELETE' });
}
