'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Product, Category, listProducts, listCategories } from '@/lib/products';
import { Customer, listCustomers } from '@/lib/customers';
import { createTransaction, Transaction, PaymentMethod } from '@/lib/transactions';
import { formatRupiah } from '@/lib/format';
import { ApiError } from '@/lib/api';
import ReceiptModal from '@/components/ReceiptModal';
import Spinner from '@/components/Spinner';
import { useToast } from '@/contexts/ToastContext';

interface CartLine {
  product: Product;
  quantity: number;
}

const THUMB_COLORS = [
  'bg-primary-fixed text-on-primary-fixed',
  'bg-secondary-fixed text-on-secondary-container',
  'bg-amber-100 text-amber-800',
  'bg-[#f3ecfe] text-debt',
  'bg-rose-100 text-rose-700',
];

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  {
    value: 'CASH',
    label: 'Tunai',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>,
  },
  {
    value: 'TRANSFER',
    label: 'Transfer',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V10M9 21V10M15 21V10M19 21V10M2 10l10-7 10 7" /></svg>,
  },
  {
    value: 'DEBT',
    label: 'Bon/Hutang',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="2.5" y="6" width="19" height="13" rx="2.5" /><path d="M2.5 10h19" /></svg>,
  },
];

export default function KasirPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [cart, setCart] = useState<Map<number, CartLine>>(new Map());
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paidAmount, setPaidAmount] = useState(0);
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Transaction | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await listProducts({
        search: debouncedSearch || undefined,
        categoryId: activeCat === 'all' ? undefined : activeCat,
        limit: 50,
      });
      setProducts(res.data.filter((p) => p.isActive));
    } catch {
      setError('Gagal memuat produk');
    } finally {
      setLoadingProducts(false);
    }
  }, [debouncedSearch, activeCat]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    listCustomers().then(setCustomers).catch(() => {});
    listCategories().then(setCategories).catch(() => {});
  }, []);

  function addToCart(product: Product) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(product.id);
      const currentQty = existing?.quantity ?? 0;
      if (currentQty + 1 > product.stock) return prev;
      next.set(product.id, { product, quantity: currentQty + 1 });
      return next;
    });
  }
  function setQuantity(productId: number, qty: number) {
    setCart((prev) => {
      const next = new Map(prev);
      const line = next.get(productId);
      if (!line) return prev;
      if (qty <= 0) next.delete(productId);
      else if (qty <= line.product.stock) next.set(productId, { ...line, quantity: qty });
      return next;
    });
  }
  function removeFromCart(productId: number) {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(productId);
      return next;
    });
  }

  const cartLines = useMemo(() => Array.from(cart.values()), [cart]);
  const subtotal = useMemo(
    () => cartLines.reduce((sum, l) => sum + l.product.sellingPrice * l.quantity, 0),
    [cartLines]
  );
  const total = Math.max(0, subtotal - discount);
  const change = paymentMethod === 'CASH' ? Math.max(0, paidAmount - total) : 0;

  function resetCart() {
    setCart(new Map());
    setDiscount(0);
    setPaidAmount(0);
    setCustomerId('');
    setPaymentMethod('CASH');
    setError('');
  }

  async function handleSubmit() {
    setError('');
    if (cartLines.length === 0) {
      setError('Keranjang masih kosong');
      return;
    }
    if (paymentMethod === 'CASH' && paidAmount < total) {
      setError('Jumlah bayar kurang dari total');
      return;
    }
    if (paymentMethod === 'DEBT' && !customerId) {
      setError('Pilih pelanggan untuk transaksi hutang');
      return;
    }
    setSubmitting(true);
    try {
      const tx = await createTransaction({
        items: cartLines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        paymentMethod,
        discount,
        paidAmount: paymentMethod === 'TRANSFER' ? total : paidAmount,
        customerId: paymentMethod === 'DEBT' ? Number(customerId) : undefined,
      });
      setReceipt(tx);
      resetCart();
      fetchProducts();
      toast.success(`Transaksi ${tx.transactionNumber} berhasil`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan transaksi');
    } finally {
      setSubmitting(false);
    }
  }

  const now = new Date();
  const dateLabel = now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
  const timeLabel = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Product selection */}
      <div className="lg:col-span-2">
        <h1 className="mb-4 text-3xl font-bold text-on-surface">Kasir Digital</h1>

        {/* Search */}
        <div className="relative mb-4">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama produk atau scan SKU..."
            className="input pl-11"
          />
        </div>

        {/* Category tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCat('all')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeCat === 'all' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            Semua
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeCat === c.id ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Product grid */}
        {loadingProducts ? (
          <Spinner />
        ) : products.length === 0 ? (
          <p className="py-10 text-center text-on-surface-variant">Tidak ada produk</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {products.map((p, i) => {
              const out = p.stock <= 0;
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={out}
                  className="card overflow-hidden p-0 text-left transition hover:border-primary hover:shadow-md disabled:cursor-not-allowed"
                >
                  <div className={`relative flex h-28 items-center justify-center text-4xl font-bold ${out ? 'bg-surface-container text-on-surface-variant grayscale' : THUMB_COLORS[i % THUMB_COLORS.length]}`}>
                    {p.name.charAt(0).toUpperCase()}
                    {out ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-bold tracking-wide text-white">HABIS</span>
                    ) : (
                      <span className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-0.5 font-mono text-[0.65rem] font-semibold text-on-surface">
                        STOK: {p.stock}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-on-surface">{p.name}</div>
                    <div className={`mt-1 font-mono text-sm font-bold ${out ? 'text-on-surface-variant' : 'text-primary'}`}>
                      {formatRupiah(p.sellingPrice)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart panel */}
      <div className="lg:col-span-1">
        <div className="card sticky top-24 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
            <div>
              <div className="font-semibold text-on-surface">Transaksi Baru</div>
              <div className="text-xs text-on-surface-variant">{dateLabel} • {timeLabel}</div>
            </div>
            <button
              onClick={resetCart}
              className="flex items-center gap-1.5 text-sm font-semibold text-danger hover:underline"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
              Reset
            </button>
          </div>

          {/* Cart items (recessed) */}
          <div className="max-h-72 min-h-[8rem] overflow-y-auto bg-surface-container-low px-5 py-3">
            {cartLines.length === 0 ? (
              <p className="py-10 text-center text-sm text-on-surface-variant">Keranjang kosong.<br />Pilih produk untuk memulai.</p>
            ) : (
              <div className="space-y-4">
                {cartLines.map((l) => (
                  <div key={l.product.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-on-surface">{l.product.name}</div>
                        <div className="font-mono text-xs text-on-surface-variant">{formatRupiah(l.product.sellingPrice)} / {l.product.unit}</div>
                      </div>
                      <div className="font-mono font-semibold text-on-surface">{formatRupiah(l.product.sellingPrice * l.quantity)}</div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex items-center rounded-lg border border-outline-variant bg-white">
                        <button onClick={() => setQuantity(l.product.id, l.quantity - 1)} className="flex h-8 w-8 items-center justify-center text-on-surface-variant hover:text-primary" aria-label="Kurangi">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M5 12h14" /></svg>
                        </button>
                        <input
                          type="number"
                          value={l.quantity}
                          onChange={(e) => setQuantity(l.product.id, Number(e.target.value))}
                          className="w-10 border-x border-outline-variant text-center font-mono text-sm focus:outline-none"
                        />
                        <button onClick={() => setQuantity(l.product.id, l.quantity + 1)} disabled={l.quantity >= l.product.stock} className="flex h-8 w-8 items-center justify-center text-on-surface-variant hover:text-primary disabled:opacity-40" aria-label="Tambah">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                        </button>
                      </div>
                      <button onClick={() => removeFromCart(l.product.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-red-50 hover:text-danger" aria-label="Hapus">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals + payment */}
          <div className="space-y-3 px-5 py-4">
            <div className="flex justify-between text-sm text-on-surface-variant">
              <span>Subtotal</span>
              <span className="font-mono">{formatRupiah(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-on-surface-variant">
              <span>Diskon</span>
              <input
                type="number"
                min={0}
                value={discount || ''}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                placeholder="0"
                className="w-28 rounded-lg border border-outline-variant px-2 py-1 text-right font-mono text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex justify-between border-t border-outline-variant pt-3 text-base font-bold text-on-surface">
              <span>Total</span>
              <span className="font-mono text-primary">{formatRupiah(total)}</span>
            </div>

            {/* Payment selector */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {PAYMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPaymentMethod(opt.value)}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold transition ${
                    paymentMethod === opt.value
                      ? 'border-primary bg-primary text-white'
                      : 'border-outline-variant bg-white text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>

            {/* CASH */}
            {paymentMethod === 'CASH' && (
              <div className="rounded-xl bg-surface-container-low p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm text-on-surface-variant">Diterima (Tunai)</span>
                  <button onClick={() => setPaidAmount(total)} className="text-xs font-semibold text-primary hover:underline">Uang Pas</button>
                </div>
                <input
                  type="number"
                  min={0}
                  value={paidAmount || ''}
                  onChange={(e) => setPaidAmount(Number(e.target.value))}
                  placeholder="Rp 0"
                  className="w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-right font-mono text-lg focus:border-primary focus:outline-none"
                />
                <div className="mt-2 flex justify-between border-t border-outline-variant pt-2 text-sm">
                  <span className="text-on-surface-variant">Kembalian</span>
                  <span className="font-mono font-bold text-primary">{formatRupiah(change)}</span>
                </div>
              </div>
            )}

            {/* DEBT */}
            {paymentMethod === 'DEBT' && (
              <div className="space-y-2 rounded-xl bg-surface-container-low p-3">
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : '')}
                  className="input"
                >
                  <option value="">Pilih pelanggan...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  value={paidAmount || ''}
                  onChange={(e) => setPaidAmount(Number(e.target.value))}
                  placeholder="Uang muka (opsional)"
                  className="input"
                />
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Sisa hutang</span>
                  <span className="font-mono font-bold text-debt">{formatRupiah(Math.max(0, total - paidAmount))}</span>
                </div>
                {customers.length === 0 && (
                  <p className="text-xs text-warning">Belum ada pelanggan. Tambahkan di menu Pelanggan.</p>
                )}
              </div>
            )}

            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-error">{error}</div>}

            <button onClick={handleSubmit} disabled={submitting || cartLines.length === 0} className="btn btn-primary w-full">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              {submitting ? 'Memproses...' : 'Proses Transaksi'}
            </button>
          </div>
        </div>
      </div>

      {receipt && <ReceiptModal transaction={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
