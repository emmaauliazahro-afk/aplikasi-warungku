import { apiFetch } from './api';

export interface OwnerInfo {
  id: number;
  name: string;
  email: string;
  role: 'OWNER' | 'CASHIER';
  createdAt: string;
}

export interface WarungSettings {
  id: number;
  storeName: string;
  ownerId: number;
  owner: OwnerInfo;
  createdAt: string;
  updatedAt: string;
}

export function getSettings() {
  return apiFetch<{ settings: WarungSettings }>('/settings');
}

export function updateSettings(data: { storeName: string; ownerName: string; ownerEmail: string }) {
  return apiFetch<{ settings: WarungSettings }>('/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function listCashiers() {
  return apiFetch<{ cashiers: OwnerInfo[] }>('/settings/cashiers');
}

export function createCashier(data: { name: string; email: string; password: string }) {
  return apiFetch<{ user: OwnerInfo }>('/settings/cashiers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
