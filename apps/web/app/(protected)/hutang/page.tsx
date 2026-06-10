'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Debt, DebtStatus, listDebts } from '@/lib/debts';
import { formatRupiah } from '@/lib/format';
import Spinner from '@/components/Spinner';
import DebtPaymentModal from '@/components/DebtPaymentModal';

const STATUS_META: Record<DebtStatus, { label: string; color: string }> = {
  UNPAID: { label: 'Belum Lunas', color: 'bg-secondary-fixed text-on-secondary-container' },
  PARTIAL: { label: 'Sebagian', color: 'bg-amber-100 text-amber-700' },
  PAID: { label: 'Lunas', color: 'bg-primary-fixed text-on-primary-fixed' },
};

const AVATAR_COLORS = [
  'bg-secondary-container text-on-secondary-container',
  'bg-rose-200 text-rose-800',
  'bg-primary-fixed text-on-primary-fixed',
  'bg-amber-200 text-amber-800',
  'bg-[#ddd0fb] text-debt',
];

type Tab = 'UNPAID' | 'ALL' | 'PAID';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}
function isOverdue(d: Debt) {
  return d.status !== 'PAID' && d.dueDate != null && new Date(d.dueDate).getTime() < Date.now();
}

export default function HutangPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [outstanding, setOutstanding] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('UNPAID');
  const [sortDesc, setSortDesc] = useState(true);
  const [payingId, setPayingId] = useState<number | null>(null);

  const fetchDebts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listDebts({ limit: 100 });
      setDebts(res.data);
      setOutstanding(res.meta.totalOutstanding);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  const debtorCount = useMemo(() => {
    const ids = new Set(debts.filter((d) => d.status !== 'PAID').map((d) => d.customerId));
    return ids.size;
  }, [debts]);

  const debtorAvatars = useMemo(() => {
    const seen = new Map<number, Debt>();
    debts.filter((d) => d.status !== 'PAID').forEach((d) => {
      if (!seen.has(d.customerId)) seen.set(d.customerId, d);
    });
    return Array.from(seen.values()).slice(0, 4);
  }, [debts]);

  const filtered = useMemo(() => {
    let list = debts;
    if (tab === 'UNPAID') list = debts.filter((d) => d.status !== 'PAID');
    else if (tab === 'PAID') list = debts.filter((d) => d.status === 'PAID');
    return [...list].sort((a, b) => (sortDesc ? b.remaining - a.remaining : a.remaining - b.remaining));
  }, [debts, tab, sortDesc]);

  const TABS: { v: Tab; l: string }[] = [
    { v: 'UNPAID', l: 'Belum Lunas' },
    { v: 'ALL', l: 'Semua Transaksi' },
    { v: 'PAID', l: 'Lunas' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-on-surface">Manajemen Hutang</h1>
        <p className="mt-1 text-on-surface-variant">Pantau piutang pelanggan dan catat pembayaran.</p>
      </div>

      {/* Top cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Gradient purple */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#5b3df0] to-[#7c3aed] p-6 text-white shadow-sm">
          <div className="label-caps !text-white/80">Total Piutang Belum Lunas</div>
          <div className="mt-2 font-mono text-4xl font-bold">{formatRupiah(outstanding)}</div>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m3 17 6-6 4 4 8-8" /><path d="M21 7v6h-6" /></svg>
            Total tunggakan aktif
          </div>
          <svg className="absolute -right-4 -bottom-4 h-28 w-28 text-white/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="2.5" y="6" width="19" height="13" rx="2.5" /><path d="M2.5 10h19" /></svg>
        </div>

        {/* Debtor count */}
        <div className="card flex flex-col justify-center p-6">
          <div className="label-caps">Pelanggan Berhutang</div>
          <div className="mt-2 font-mono text-4xl font-bold text-on-surface">{debtorCount} <span className="text-2xl">Orang</span></div>
          <div className="mt-3 flex items-center">
            {debtorAvatars.map((d, i) => (
              <div
                key={d.customerId}
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-semibold ${AVATAR_COLORS[i % AVATAR_COLORS.length]} ${i > 0 ? '-ml-2' : ''}`}
              >
                {initials(d.customer?.name)}
              </div>
            ))}
            {debtorCount > debtorAvatars.length && (
              <div className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-surface-container text-xs font-semibold text-on-surface-variant">
                +{debtorCount - debtorAvatars.length}
              </div>
            )}
          </div>
        </div>

        {/* Action card → kasir (debts created via POS) */}
        <Link
          href="/kasir"
          className="flex flex-col items-center justify-center rounded-2xl bg-primary p-6 text-center text-white shadow-sm transition hover:bg-[#00553b]"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="6" width="19" height="13" rx="2.5" /><path d="M2.5 10h19" /><path d="M17 15h2M12 15h2" /></svg>
          </span>
          <div className="mt-3 text-lg font-bold">Catat Hutang Baru</div>
          <div className="text-sm text-white/80">Buat transaksi hutang via Kasir</div>
        </Link>
      </div>

      {/* Tabs + sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-outline-variant bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                tab === t.v ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSortDesc((s) => !s)}
          className="btn btn-ghost self-start sm:self-auto"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M6 12h12M9 18h6" /></svg>
          Urutkan: Sisa {sortDesc ? 'Terbesar' : 'Terkecil'}
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-outline-variant bg-surface-container-low">
              <tr className="[&>th]:px-5 [&>th]:py-3.5">
                <th><span className="label-caps">Nama Pelanggan</span></th>
                <th><span className="label-caps">Terakhir Transaksi</span></th>
                <th><span className="label-caps">Jatuh Tempo</span></th>
                <th className="text-right"><span className="label-caps">Total Hutang</span></th>
                <th><span className="label-caps">Status</span></th>
                <th className="text-center"><span className="label-caps">Aksi</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-6"><Spinner /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-on-surface-variant">Tidak ada data hutang</td></tr>
              ) : (
                filtered.map((d, i) => {
                  const overdue = isOverdue(d);
                  return (
                    <tr key={d.id} className="transition hover:bg-surface-container-low">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                            {initials(d.customer?.name)}
                          </div>
                          <div>
                            <div className="font-semibold text-on-surface">{d.customer?.name}</div>
                            <div className="font-mono text-xs text-on-surface-variant">
                              {d.customer?.phone || d.transaction?.transactionNumber || '-'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-on-surface-variant">{fmtDate(d.createdAt)}</td>
                      <td className="px-5 py-4">
                        {d.dueDate ? (
                          <span className={overdue ? 'font-semibold italic text-error' : 'text-on-surface-variant'}>
                            {overdue ? 'Melewati Batas' : fmtDate(d.dueDate)}
                          </span>
                        ) : (
                          <span className="text-on-surface-variant">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-semibold text-on-surface">{formatRupiah(d.remaining)}</td>
                      <td className="px-5 py-4">
                        <span className={`pill ${overdue ? 'bg-red-100 text-error' : STATUS_META[d.status].color}`}>
                          {overdue ? 'Peringatan' : STATUS_META[d.status].label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => setPayingId(d.id)}
                          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                            d.status === 'PAID'
                              ? 'border border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                              : 'bg-primary text-white hover:bg-[#00553b]'
                          }`}
                        >
                          {d.status === 'PAID' ? 'Lihat' : 'Bayar'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-outline-variant bg-surface-container-low px-5 py-3.5 text-sm text-on-surface-variant">
          Menampilkan {filtered.length} data hutang
        </div>
      </div>

      {payingId !== null && (
        <DebtPaymentModal debtId={payingId} onClose={() => setPayingId(null)} onPaid={fetchDebts} />
      )}
    </div>
  );
}
