'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSalesReport, getExportUrl, getTopProducts, SalesReportData, TopProduct, ReportParams } from '@/lib/reports';
import { formatRupiah } from '@/lib/format';
import Spinner from '@/components/Spinner';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function LaporanPage() {
  const [tab, setTab] = useState<'sales' | 'products'>('sales');
  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate, setEndDate] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState('');

  const params: ReportParams = { startDate, endDate, paymentMethod: paymentMethod || undefined };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-on-surface">Laporan</h1>
        <p className="mt-1 text-on-surface-variant">Analisa performa penjualan warung Anda.</p>
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-xl border border-outline-variant bg-white p-1">
        <button onClick={() => setTab('sales')} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === 'sales' ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-low'}`}>Penjualan</button>
        <button onClick={() => setTab('products')} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === 'products' ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-low'}`}>Produk Terlaris</button>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Dari</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Sampai</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
        </div>
        {tab === 'sales' && (
          <div>
            <label className="label">Metode</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="input">
              <option value="">Semua</option>
              <option value="CASH">Tunai</option>
              <option value="TRANSFER">Transfer</option>
              <option value="DEBT">Hutang</option>
            </select>
          </div>
        )}
        {tab === 'sales' && (
          <button onClick={() => window.open(getExportUrl(params), '_blank')} className="btn btn-info">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M8 11l4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
            Export CSV
          </button>
        )}
      </div>

      {tab === 'sales' ? <SalesTab params={params} /> : <TopProductsTab startDate={startDate} endDate={endDate} />}
    </div>
  );
}

function SalesTab({ params }: { params: ReportParams }) {
  const [data, setData] = useState<SalesReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try { setData(await getSalesReport(params)); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.startDate, params.endDate, params.paymentMethod]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const shortDate = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

  if (loading) return <Spinner />;
  if (!data) return <p className="py-8 text-center text-on-surface-variant">Gagal memuat data</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card label="Omzet" value={formatRupiah(data.summary.revenue)} color="text-primary" bg="#e7f7ef" />
        <Card label="Profit" value={formatRupiah(data.summary.profit)} color="text-secondary" bg="#e7f1f8" />
        <Card label="Transaksi" value={String(data.summary.transactions)} color="text-debt" bg="#f3ecfe" />
        <Card label="Diskon" value={formatRupiah(data.summary.discount)} color="text-warning" bg="#fef6e7" />
      </div>

      {data.daily.length > 0 && (
        <div className="card p-6">
          <h2 className="mb-4 text-xl font-bold text-on-surface">Omzet Harian</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef4ee" vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6d7a72' }} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}rb`} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6d7a72' }} />
              <Tooltip formatter={(value) => [formatRupiah(Number(value)), 'Omzet']} labelFormatter={shortDate} contentStyle={{ borderRadius: 12, border: '1px solid #bccac0', fontSize: 13 }} cursor={{ fill: 'rgba(0,105,72,0.06)' }} />
              <Bar dataKey="revenue" fill="#006948" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-outline-variant bg-surface-container-low">
              <tr className="[&>th]:px-5 [&>th]:py-3.5">
                <th><span className="label-caps">No. Transaksi</span></th>
                <th><span className="label-caps">Tanggal</span></th>
                <th><span className="label-caps">Pelanggan</span></th>
                <th><span className="label-caps">Metode</span></th>
                <th className="text-right"><span className="label-caps">Total</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {data.transactions.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-on-surface-variant">Tidak ada transaksi</td></tr>
              ) : data.transactions.map((t) => (
                <tr key={t.id} className="transition hover:bg-surface-container-low">
                  <td className="px-5 py-4 font-mono font-semibold text-on-surface">{t.transactionNumber}</td>
                  <td className="px-5 py-4 text-on-surface-variant">{new Date(t.createdAt).toLocaleDateString('id-ID')}</td>
                  <td className="px-5 py-4 text-on-surface-variant">{t.customer ?? '-'}</td>
                  <td className="px-5 py-4">
                    <span className={`pill ${
                      t.paymentMethod === 'CASH' ? 'bg-primary-fixed text-on-primary-fixed' :
                      t.paymentMethod === 'TRANSFER' ? 'bg-secondary-fixed text-on-secondary-container' :
                      'bg-[#f3ecfe] text-debt'
                    }`}>{t.paymentMethod === 'CASH' ? 'Tunai' : t.paymentMethod === 'TRANSFER' ? 'Transfer' : 'Hutang'}</span>
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-semibold text-on-surface">{formatRupiah(t.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TopProductsTab({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'quantity' | 'revenue'>('quantity');

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try { setProducts(await getTopProducts({ startDate, endDate, sortBy, limit: 10 })); } finally { setLoading(false); }
  }, [startDate, endDate, sortBy]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl border border-outline-variant bg-white p-1">
        <button onClick={() => setSortBy('quantity')} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${sortBy === 'quantity' ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-low'}`}>Terbanyak Terjual</button>
        <button onClick={() => setSortBy('revenue')} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${sortBy === 'revenue' ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-low'}`}>Omzet Tertinggi</button>
      </div>

      {loading ? (
        <Spinner />
      ) : products.length === 0 ? (
        <div className="card px-4 py-10 text-center text-on-surface-variant">Belum ada data penjualan</div>
      ) : (
        <div className="space-y-3">
          {products.map((p, idx) => (
            <div key={p.productId} className="card flex items-center gap-4 p-4">
              <div className={`flex h-11 w-11 items-center justify-center rounded-full font-mono text-sm font-bold ${idx < 3 ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                {p.rank}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-on-surface">{p.name}</div>
                <div className="text-xs text-on-surface-variant">{p.quantity} terjual · Profit {formatRupiah(p.profit)}</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-on-surface">{formatRupiah(p.revenue)}</div>
                <div className="label-caps">Omzet</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div className="card p-5" style={{ backgroundColor: bg }}>
      <span className="label-caps">{label}</span>
      <div className={`mt-2 font-mono text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
