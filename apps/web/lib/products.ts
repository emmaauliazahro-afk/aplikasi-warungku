import { apiFetch } from './api';

export interface Category {
  id: number;
  name: string;
  productCount?: number;
}

export interface Product {
  id: number;
  sku: string | null;
  name: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  categoryId: number | null;
  isActive: boolean;
  category?: Category | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ProductListResult {
  data: Product[];
  meta: ProductListMeta;
}

export interface ProductInput {
  sku?: string | null;
  name: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  categoryId?: number | null;
}

export interface ListProductParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: number;
  lowStock?: boolean;
  sortBy?: 'name' | 'stock' | 'sellingPrice' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// listProducts needs the meta, so we call the raw endpoint and read both data + meta
export async function listProducts(
  params: ListProductParams = {}
): Promise<ProductListResult> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== null) {
      qs.set(key, String(value));
    }
  });
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';
  const res = await fetch(`${API_URL}/products?${qs.toString()}`, {
    credentials: 'include',
  });
  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body.message ?? 'Gagal memuat produk');
  }
  return { data: body.data, meta: body.meta };
}

export function getProduct(id: number) {
  return apiFetch<Product>(`/products/${id}`);
}

export function createProduct(input: ProductInput) {
  return apiFetch<Product>('/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateProduct(id: number, input: Partial<ProductInput>) {
  return apiFetch<Product>(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteProduct(id: number) {
  return apiFetch<null>(`/products/${id}`, { method: 'DELETE' });
}

export function listCategories() {
  return apiFetch<Category[]>('/categories');
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';

export interface ImportResultRow {
  row: number;
  name?: string;
  message: string;
}

export interface ImportResult {
  totalRows: number;
  created: number;
  failedCount: number;
  failed: ImportResultRow[];
}

export async function importProducts(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/products/import`, {
    method: 'POST',
    credentials: 'include',
    body: formData, // do NOT set Content-Type; browser sets multipart boundary
  });
  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body.message ?? 'Gagal mengimpor produk');
  }
  return body.data;
}

export type StockMovementType = 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'RETURN';

export interface StockMovement {
  id: number;
  productId: number;
  type: StockMovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  note: string | null;
  referenceId: number | null;
  createdAt: string;
}

export interface StockMovementResult {
  data: StockMovement[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export async function getStockMovements(
  productId: number,
  page = 1
): Promise<StockMovementResult> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';
  const res = await fetch(`${API_URL}/products/${productId}/movements?page=${page}`, {
    credentials: 'include',
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.message ?? 'Gagal memuat riwayat stok');
  return { data: body.data, meta: body.meta };
}

export type AdjustMode = 'SET' | 'ADD' | 'SUBTRACT';

export function adjustStock(
  productId: number,
  input: { mode: AdjustMode; amount: number; note?: string }
) {
  return apiFetch<Product>(`/products/${productId}/adjust-stock`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// Download the CSV template (fetch as blob to include credentials)
export async function downloadTemplate(): Promise<void> {
  const res = await fetch(`${API_BASE}/products/import/template`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Gagal mengunduh template');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'template-produk.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
