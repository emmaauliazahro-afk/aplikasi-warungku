'use client';

import { useState, useEffect, useCallback } from 'react';
import { Product, listProducts } from '@/lib/products';
import { formatRupiah } from '@/lib/format';
import Spinner from '@/components/Spinner';
import StockAdjustModal from '@/components/StockAdjustModal';

export default function StokPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [adjusting, setAdjusting] = useState<Product | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listProducts({
        search: debouncedSearch || undefined,
        lowStock: onlyLow || undefined,
        limit: 100,
        sortBy: 'stock',
        sortOrder: 'asc',
      });
      setProducts(res.data);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, onlyLow]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const lowCount = products.filter((p) => p.stock <= p.minStock).length;
  const totalValue = products.reduce((s, p) => s + p.stock * p.purchasePrice, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-on-surface">Manajemen Stok</h1>
        <p className="mt-1 text-on-surface-variant">Pantau level stok dan lakukan penyesuaian.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5" style={{ backgroundColor: '#e7f7ef' }}>
          <span className="label-caps">Total Item Stok</span>
          <div className="mt-2 font-mono text-3xl font-bold text-primary">{products.length}</div>
        </div>
        <div className="card p-5" style={{ backgroundColor: '#fef6e7' }}>
          <span className="label-caps">Perlu Re-stok</span>
          <div className="mt-2 font-mono text-3xl font-bold text-warning">{lowCount}</div>
        </div>
        <div className="card p-5" style={{ backgroundColor: '#e7f1f8' }}>
          <span className="label-caps">Nilai Stok</span>
          <div className="mt-2 font-mono text-3xl font-bold text-secondary">{formatRupiah(totalValue)}</div>
        </div>
      </div>

      {/* Low stock banner */}
      {lowCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
          <span><strong>{lowCount} produk</strong> memiliki stok menipis dan perlu segera direstok.</span>
        </div>
      )}

      {/* Filters */}
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari produk..."
            className="input pl-11"
          />
        </div>
        <label className="flex h-11 items-center gap-2 rounded-xl border border-outline-variant px-4 text-sm font-medium text-on-surface-variant">
          <input
            type="checkbox"
            checked={onlyLow}
            onChange={(e) => setOnlyLow(e.target.checked)}
            className="h-4 w-4 rounded border-outline-variant accent-primary"
          />
          Hanya stok menipis
        </label>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-outline-variant bg-surface-container-low">
              <tr className="[&>th]:px-5 [&>th]:py-3.5">
                <th><span className="label-caps">Produk</span></th>
                <th className="text-right"><span className="label-caps">Stok</span></th>
                <th className="text-right"><span className="label-caps">Min. Stok</span></th>
                <th><span className="label-caps">Status</span></th>
                <th className="text-right"><span className="label-caps">Nilai Stok</span></th>
                <th className="text-center"><span className="label-caps">Aksi</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-6"><Spinner /></td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-on-surface-variant">Tidak ada produk</td></tr>
              ) : (
                products.map((p) => {
                  const low = p.stock <= p.minStock;
                  const out = p.stock <= 0;
                  return (
                    <tr key={p.id} className="transition hover:bg-surface-container-low">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-on-surface">{p.name}</div>
                        {p.sku && <div className="font-mono text-xs text-on-surface-variant">{p.sku}</div>}
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-semibold text-on-surface">{p.stock} {p.unit}</td>
                      <td className="px-5 py-4 text-right font-mono text-on-surface-variant">{p.minStock}</td>
                      <td className="px-5 py-4">
                        {out ? (
                          <span className="pill bg-red-100 text-error">Habis</span>
                        ) : low ? (
                          <span className="pill bg-amber-100 text-amber-700">Menipis</span>
                        ) : (
                          <span className="pill bg-primary-fixed text-on-primary-fixed">Aman</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-on-surface-variant">{formatRupiah(p.stock * p.purchasePrice)}</td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => setAdjusting(p)}
                          className="rounded-lg border border-outline-variant px-3 py-1.5 text-sm font-semibold text-secondary transition hover:bg-secondary-fixed"
                        >
                          Sesuaikan
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {adjusting && (
        <StockAdjustModal
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onAdjusted={fetchProducts}
        />
      )}
    </div>
  );
}
