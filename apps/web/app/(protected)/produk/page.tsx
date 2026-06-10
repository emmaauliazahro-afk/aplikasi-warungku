'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Product,
  Category,
  listProducts,
  listCategories,
  deleteProduct,
  ProductListMeta,
} from '@/lib/products';
import { formatRupiah } from '@/lib/format';
import ProductFormModal from '@/components/ProductFormModal';
import ImportModal from '@/components/ImportModal';
import Spinner from '@/components/Spinner';
import { useToast } from '@/contexts/ToastContext';

const THUMB_COLORS = [
  'bg-primary-fixed text-on-primary-fixed',
  'bg-secondary-fixed text-on-secondary-container',
  'bg-amber-100 text-amber-800',
  'bg-[#f3ecfe] text-debt',
  'bg-rose-100 text-rose-700',
];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  const days = Math.floor(hrs / 24);
  return `${days} hari lalu`;
}

export default function ProdukPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<ProductListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);

  // modal / delete state
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listProducts({
        page,
        limit: 10,
        search: debouncedSearch || undefined,
        categoryId: categoryId || undefined,
        lowStock: lowStock || undefined,
      });
      setProducts(result.data);
      setMeta(result.meta);
    } catch {
      setError('Gagal memuat produk');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, categoryId, lowStock]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {});
  }, []);

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setShowForm(true);
  }
  function handleSaved() {
    setShowForm(false);
    setEditing(null);
    toast.success(editing ? 'Produk berhasil diperbarui' : 'Produk berhasil ditambahkan');
    fetchProducts();
    listCategories().then(setCategories).catch(() => {});
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await deleteProduct(deleting.id);
      toast.success(`${deleting.name} berhasil dihapus`);
      setDeleting(null);
      fetchProducts();
    } catch {
      toast.error('Gagal menghapus produk');
    } finally {
      setDeleteLoading(false);
    }
  }

  const lowCount = products.filter((p) => p.stock <= p.minStock).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">Manajemen Produk</h1>
          <p className="mt-1 text-on-surface-variant">
            Kelola daftar inventaris dan pantau ketersediaan stok barang Anda.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowImport(true)} className="btn btn-secondary">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M8 7l4-4 4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
            Import CSV
          </button>
          <button onClick={openCreate} className="btn btn-primary">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Tambah Produk Baru
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama produk atau SKU..."
            className="input pl-11"
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value ? Number(e.target.value) : '');
            setPage(1);
          }}
          className="input sm:max-w-[200px]"
        >
          <option value="">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex h-11 items-center gap-2 rounded-xl border border-outline-variant px-4 text-sm font-medium text-on-surface-variant">
          <input
            type="checkbox"
            checked={lowStock}
            onChange={(e) => {
              setLowStock(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-outline-variant accent-primary"
          />
          Stok Menipis
        </label>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-error">{error}</div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-outline-variant bg-surface-container-low">
              <tr className="[&>th]:px-5 [&>th]:py-3.5">
                <th><span className="label-caps">Produk</span></th>
                <th><span className="label-caps">SKU</span></th>
                <th><span className="label-caps">Kategori</span></th>
                <th className="text-right"><span className="label-caps">Harga Beli</span></th>
                <th className="text-right"><span className="label-caps">Harga Jual</span></th>
                <th><span className="label-caps">Stok</span></th>
                <th className="text-center"><span className="label-caps">Aksi</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-6"><Spinner /></td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-on-surface-variant">
                    Tidak ada produk ditemukan
                  </td>
                </tr>
              ) : (
                products.map((p, i) => {
                  const dotColor =
                    p.stock <= 0 ? 'bg-danger' : p.stock <= p.minStock ? 'bg-warning' : 'bg-success';
                  const stockText =
                    p.stock <= 0 ? 'text-danger' : p.stock <= p.minStock ? 'text-warning' : 'text-on-surface';
                  return (
                    <tr key={p.id} className="transition hover:bg-surface-container-low">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${THUMB_COLORS[i % THUMB_COLORS.length]}`}>
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-on-surface">{p.name}</div>
                            <div className="text-xs text-on-surface-variant">Update: {relativeTime(p.updatedAt)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-on-surface-variant">{p.sku ?? '-'}</td>
                      <td className="px-5 py-4">
                        {p.category ? (
                          <span className="pill bg-secondary-fixed text-on-secondary-container">{p.category.name}</span>
                        ) : (
                          <span className="text-on-surface-variant">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-on-surface-variant">{formatRupiah(p.purchasePrice)}</td>
                      <td className="px-5 py-4 text-right font-mono font-semibold text-on-surface">{formatRupiah(p.sellingPrice)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-2 font-mono font-semibold ${stockText}`}>
                          <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                          {p.stock} <span className="text-xs font-normal text-on-surface-variant">{p.unit}</span>
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            aria-label="Edit"
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-secondary-fixed hover:text-secondary"
                          >
                            <svg className="h-4.5 w-4.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                          </button>
                          <button
                            onClick={() => setDeleting(p)}
                            aria-label="Hapus"
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-red-50 hover:text-danger"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-outline-variant bg-surface-container-low px-5 py-3.5 sm:flex-row">
            <span className="text-sm text-on-surface-variant">
              Menampilkan {products.length} dari {meta.total} produk
            </span>
            {meta.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant bg-white text-on-surface-variant disabled:opacity-40 hover:bg-surface-container"
                  aria-label="Sebelumnya"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-primary px-3 font-mono text-sm font-semibold text-white">
                  {meta.page}
                </span>
                <span className="text-sm text-on-surface-variant">/ {meta.totalPages}</span>
                <button
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant bg-white text-on-surface-variant disabled:opacity-40 hover:bg-surface-container"
                  aria-label="Berikutnya"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="m9 18 6-6-6-6" /></svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card bg-primary-fixed/30 p-5" style={{ backgroundColor: '#e7f7ef' }}>
          <div className="flex items-center justify-between">
            <span className="label-caps">Produk (Halaman Ini)</span>
            <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 8 12 3 3 8l9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /></svg>
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-primary">{products.length}</div>
          <div className="mt-1 text-xs text-on-surface-variant">dari {meta?.total ?? 0} total produk</div>
        </div>
        <div className="card p-5" style={{ backgroundColor: '#fef6e7' }}>
          <div className="flex items-center justify-between">
            <span className="label-caps">Perlu Re-stok</span>
            <svg className="h-5 w-5 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-warning">{lowCount}</div>
          <div className="mt-1 text-xs text-on-surface-variant">produk stok menipis di halaman ini</div>
        </div>
        <div className="card p-5" style={{ backgroundColor: '#e7f1f8' }}>
          <div className="flex items-center justify-between">
            <span className="label-caps">Total Kategori</span>
            <svg className="h-5 w-5 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-secondary">{categories.length}</div>
          <div className="mt-1 text-xs text-on-surface-variant">kategori produk terdaftar</div>
        </div>
      </div>

      {/* Modals */}
      {showForm && (
        <ProductFormModal
          product={editing}
          categories={categories}
          onClose={() => setShowForm(false)}
          onSaved={handleSaved}
        />
      )}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => {
            fetchProducts();
            listCategories().then(setCategories).catch(() => {});
          }}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-on-surface">Hapus Produk?</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Anda yakin ingin menghapus <strong>{deleting.name}</strong>? Jika produk memiliki
              riwayat transaksi, produk akan dinonaktifkan.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setDeleting(null)} className="btn btn-ghost">
                Batal
              </button>
              <button onClick={confirmDelete} disabled={deleteLoading} className="btn btn-danger">
                {deleteLoading ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
