'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getDashboardStats, DashboardStats } from '@/lib/dashboard';
import { listTransactions, Transaction } from '@/lib/transactions';
import { formatRupiah, formatNumber } from '@/lib/format';
import SalesTrendChart from '@/components/SalesTrendChart';
import Spinner from '@/components/Spinner';

interface CardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  valueClass?: string;
  cardClass?: string;
  href?: string;
  hint?: React.ReactNode;
}

function StatCard({ label, value, icon, iconBg, valueClass, cardClass, href, hint }: CardProps) {
  const inner = (
    <div className={`card h-full p-5 transition hover:shadow-md ${cardClass ?? ''}`}>
      <div className="flex items-center justify-between">
        <span className="label-caps">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${iconBg}`}>
          {icon}
        </span>
      </div>
      <div className={`mt-3 font-mono text-3xl font-bold ${valueClass ?? 'text-on-surface'}`}>
        {value}
      </div>
      {hint && <div className="mt-1.5 text-xs font-medium">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function methodBadge(m: Transaction['paymentMethod']) {
  if (m === 'DEBT') return { bg: 'bg-[#f3ecfe] text-debt', label: 'Hutang' };
  if (m === 'TRANSFER') return { bg: 'bg-secondary-fixed text-on-secondary-container', label: 'Transfer' };
  return { bg: 'bg-primary-fixed text-on-primary-fixed', label: 'Tunai' };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      getDashboardStats(),
      listTransactions({ limit: 5 }).then((r) => r.data).catch(() => []),
    ])
      .then(([s, r]) => {
        setStats(s);
        setRecent(r);
      })
      .catch(() => setError('Gagal memuat statistik'))
      .finally(() => setLoading(false));
  }, []);

  const firstName = user?.name?.split(' ')[0] ?? '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">Halo, {firstName}!</h1>
          <p className="mt-1 text-on-surface-variant">Berikut ringkasan warung Anda hari ini.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/produk" className="btn btn-secondary">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 8 12 3 3 8l9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /></svg>
            Tambah Produk
          </Link>
          <Link href="/kasir" className="btn btn-primary">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /><path d="M2 3h2l2.6 12.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L23 6H5.1" /></svg>
            Buka Kasir
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-error">{error}</div>
      )}

      {loading ? (
        <Spinner />
      ) : stats ? (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Omzet Hari Ini"
              value={formatRupiah(stats.todayRevenue)}
              icon={<svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>}
              iconBg="bg-primary-fixed"
              hint={<span className="text-success">{formatNumber(stats.todayTransactions)} transaksi hari ini</span>}
            />
            <StatCard
              label="Jumlah Transaksi"
              value={formatNumber(stats.todayTransactions)}
              icon={<svg className="h-5 w-5 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h5" /></svg>}
              iconBg="bg-secondary-fixed"
              hint={<span className="text-on-surface-variant">Transaksi hari ini</span>}
            />
            <StatCard
              label="Stok Menipis"
              value={formatNumber(stats.lowStockCount)}
              icon={<svg className="h-5 w-5 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>}
              iconBg="bg-red-100"
              cardClass="!border-red-200 bg-red-50"
              valueClass="text-error"
              href="/produk"
              hint={<span className="text-error">Perlu restok segera</span>}
            />
            <StatCard
              label="Total Piutang"
              value={formatRupiah(stats.totalDebt)}
              icon={<svg className="h-5 w-5 text-debt" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="2.5" y="6" width="19" height="13" rx="2.5" /><path d="M2.5 10h19M6 15h4" /></svg>}
              iconBg="bg-[#f3ecfe]"
              valueClass="text-debt"
              href="/hutang"
              hint={<span className="text-on-surface-variant">{formatNumber(stats.totalCustomers)} pelanggan</span>}
            />
          </div>

          {/* Chart + recent */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="card p-6 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-on-surface">Tren Penjualan</h2>
                <span className="rounded-lg bg-surface-container-low px-3 py-1.5 text-sm font-medium text-on-surface-variant">
                  7 Hari Terakhir
                </span>
              </div>
              <SalesTrendChart data={stats.salesTrend} />
            </div>

            <div className="card flex flex-col p-6">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xl font-bold leading-tight text-on-surface">Transaksi<br />Terakhir</h2>
                <Link href="/laporan" className="text-sm font-semibold text-primary hover:underline">
                  Lihat Semua
                </Link>
              </div>
              <div className="flex-1 divide-y divide-outline-variant">
                {recent.length === 0 ? (
                  <p className="py-8 text-center text-sm text-on-surface-variant">Belum ada transaksi.</p>
                ) : (
                  recent.map((t) => {
                    const b = methodBadge(t.paymentMethod);
                    const time = new Date(t.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={t.id} className="flex items-center gap-3 py-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${b.bg}`}>
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /><path d="M2 3h2l2.6 12.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L23 6H5.1" /></svg>
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-sm font-semibold text-on-surface">#{t.transactionNumber}</div>
                          <div className="text-xs text-on-surface-variant">
                            {time} • {t._count?.items ?? t.items?.length ?? 0} produk
                          </div>
                        </div>
                        <div className={`font-mono text-sm font-bold ${t.paymentMethod === 'DEBT' ? 'text-debt' : 'text-on-surface'}`}>
                          {formatRupiah(t.totalAmount)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
