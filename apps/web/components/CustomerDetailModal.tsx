'use client';

import { useState, useEffect } from 'react';
import { CustomerDetail, getCustomer } from '@/lib/customers';
import { formatRupiah } from '@/lib/format';
import Spinner from '@/components/Spinner';

const DEBT_STATUS: Record<string, { label: string; color: string }> = {
  UNPAID: { label: 'Belum Bayar', color: 'bg-secondary-fixed text-on-secondary-container' },
  PARTIAL: { label: 'Sebagian', color: 'bg-amber-100 text-amber-700' },
  PAID: { label: 'Lunas', color: 'bg-primary-fixed text-on-primary-fixed' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CustomerDetailModal({
  customerId,
  onClose,
}: {
  customerId: number;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCustomer(customerId)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [customerId]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-on-surface">Detail Pelanggan</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface" aria-label="Tutup">
            ✕
          </button>
        </div>

        {loading ? (
          <Spinner />
        ) : !detail ? (
          <p className="text-on-surface-variant">Data tidak ditemukan</p>
        ) : (
          <div className="space-y-5">
            {/* Info */}
            <div className="rounded-xl bg-surface-container-low p-4">
              <h3 className="text-xl font-bold text-on-surface">{detail.name}</h3>
              {detail.phone && <p className="text-sm text-on-surface-variant">📞 {detail.phone}</p>}
              {detail.address && <p className="text-sm text-on-surface-variant">📍 {detail.address}</p>}
              <div className="mt-3 flex gap-6">
                <div>
                  <div className="label-caps">Total Hutang</div>
                  <div className={`font-mono text-lg font-bold ${detail.totalDebt > 0 ? 'text-debt' : 'text-primary'}`}>
                    {formatRupiah(detail.totalDebt)}
                  </div>
                </div>
                <div>
                  <div className="label-caps">Total Transaksi</div>
                  <div className="font-mono text-lg font-bold text-on-surface">{detail.transactions.length}</div>
                </div>
              </div>
            </div>

            {/* Debts */}
            <div>
              <h4 className="mb-2 text-sm font-semibold text-on-surface">Hutang</h4>
              {detail.debts.length === 0 ? (
                <p className="text-sm text-on-surface-variant">Tidak ada hutang</p>
              ) : (
                <div className="space-y-2">
                  {detail.debts.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-xl border border-outline-variant px-3 py-2 text-sm">
                      <div>
                        <span className={`pill ${DEBT_STATUS[d.status].color}`}>
                          {DEBT_STATUS[d.status].label}
                        </span>
                        <span className="ml-2 text-xs text-on-surface-variant">{fmtDate(d.createdAt)}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-semibold text-on-surface">{formatRupiah(d.remaining)}</div>
                        <div className="font-mono text-xs text-on-surface-variant">dari {formatRupiah(d.amount)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Transactions */}
            <div>
              <h4 className="mb-2 text-sm font-semibold text-on-surface">Riwayat Transaksi (terbaru)</h4>
              {detail.transactions.length === 0 ? (
                <p className="text-sm text-on-surface-variant">Belum ada transaksi</p>
              ) : (
                <div className="space-y-1">
                  {detail.transactions.map((t) => (
                    <div key={t.id} className="flex items-center justify-between border-b border-outline-variant py-1.5 text-sm">
                      <div>
                        <span className="font-mono font-semibold text-on-surface">{t.transactionNumber}</span>
                        <span className="ml-2 text-xs text-on-surface-variant">{fmtDate(t.createdAt)}</span>
                      </div>
                      <span className="font-mono font-semibold text-on-surface">{formatRupiah(t.totalAmount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
