'use client';

import { useState, useEffect } from 'react';
import { Debt, getDebt, recordPayment } from '@/lib/debts';
import { formatRupiah } from '@/lib/format';
import { ApiError } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import Spinner from '@/components/Spinner';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function DebtPaymentModal({
  debtId,
  onClose,
  onPaid,
}: {
  debtId: number;
  onClose: () => void;
  onPaid: () => void;
}) {
  const toast = useToast();
  const [debt, setDebt] = useState<Debt | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function load() {
    getDebt(debtId)
      .then(setDebt)
      .catch(() => setError('Gagal memuat data hutang'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debtId]);

  async function handlePay() {
    if (amount <= 0) {
      setError('Masukkan jumlah pembayaran');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const updated = await recordPayment(debtId, amount, note || undefined);
      setDebt(updated);
      setAmount(0);
      setNote('');
      toast.success(updated.status === 'PAID' ? 'Hutang lunas!' : 'Pembayaran berhasil dicatat');
      onPaid();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mencatat pembayaran');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-on-surface">Pembayaran Hutang</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface" aria-label="Tutup">✕</button>
        </div>

        {loading ? (
          <Spinner />
        ) : !debt ? (
          <p className="text-on-surface-variant">Data tidak ditemukan</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface-container-low p-4">
              <div className="font-semibold text-on-surface">{debt.customer?.name}</div>
              {debt.transaction && (
                <div className="font-mono text-xs text-on-surface-variant">{debt.transaction.transactionNumber}</div>
              )}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <div className="label-caps">Total</div>
                  <div className="font-mono font-semibold text-on-surface">{formatRupiah(debt.amount)}</div>
                </div>
                <div>
                  <div className="label-caps">Dibayar</div>
                  <div className="font-mono font-semibold text-primary">{formatRupiah(debt.paidAmount)}</div>
                </div>
                <div>
                  <div className="label-caps">Sisa</div>
                  <div className="font-mono font-semibold text-debt">{formatRupiah(debt.remaining)}</div>
                </div>
              </div>
            </div>

            {debt.status !== 'PAID' ? (
              <div className="space-y-2">
                <input
                  type="number"
                  min={0}
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="Jumlah pembayaran"
                  className="input"
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => setAmount(debt.remaining)}
                    className="rounded-lg bg-secondary-fixed px-3 py-1.5 text-xs font-semibold text-on-secondary-container hover:opacity-90"
                  >
                    Bayar Lunas ({formatRupiah(debt.remaining)})
                  </button>
                </div>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Catatan (opsional)"
                  className="input"
                />
                {error && (
                  <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-error">{error}</div>
                )}
                <button
                  onClick={handlePay}
                  disabled={submitting || amount <= 0}
                  className="btn btn-primary w-full"
                >
                  {submitting ? 'Menyimpan...' : 'Catat Pembayaran'}
                </button>
              </div>
            ) : (
              <div className="rounded-xl bg-primary-fixed px-4 py-3 text-center text-sm font-semibold text-on-primary-fixed">
                ✓ Hutang sudah lunas
              </div>
            )}

            {/* Payment history */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-on-surface">Riwayat Pembayaran</h3>
              {!debt.payments || debt.payments.length === 0 ? (
                <p className="text-sm text-on-surface-variant">Belum ada pembayaran</p>
              ) : (
                <div className="space-y-1">
                  {debt.payments.map((p) => (
                    <div key={p.id} className="flex justify-between border-b border-outline-variant py-1.5 text-sm">
                      <span className="text-on-surface-variant">{fmtDate(p.createdAt)}</span>
                      <span className="font-mono font-semibold text-primary">{formatRupiah(p.amount)}</span>
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
