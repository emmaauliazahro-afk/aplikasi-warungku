'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Product,
  StockMovement,
  AdjustMode,
  getStockMovements,
  adjustStock,
} from '@/lib/products';
import { ApiError } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

const TYPE_LABELS: Record<string, string> = {
  PURCHASE: 'Masuk',
  SALE: 'Penjualan',
  ADJUSTMENT: 'Penyesuaian',
  RETURN: 'Retur',
};
const TYPE_COLORS: Record<string, string> = {
  PURCHASE: 'bg-primary-fixed text-on-primary-fixed',
  SALE: 'bg-secondary-fixed text-on-secondary-container',
  ADJUSTMENT: 'bg-amber-100 text-amber-700',
  RETURN: 'bg-surface-container text-on-surface-variant',
};

export default function StockAdjustModal({
  product,
  onClose,
  onAdjusted,
}: {
  product: Product;
  onClose: () => void;
  onAdjusted: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<AdjustMode>('ADD');
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [currentStock, setCurrentStock] = useState(product.stock);

  const loadMovements = useCallback(() => {
    getStockMovements(product.id)
      .then((r) => setMovements(r.data))
      .catch(() => {});
  }, [product.id]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  async function handleSubmit() {
    setError('');
    setSubmitting(true);
    try {
      const updated = await adjustStock(product.id, { mode, amount, note: note || undefined });
      setCurrentStock(updated.stock);
      setAmount(0);
      setNote('');
      loadMovements();
      onAdjusted();
      toast.success(`Stok ${product.name} diperbarui menjadi ${updated.stock}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyesuaikan stok');
    } finally {
      setSubmitting(false);
    }
  }

  const preview =
    mode === 'SET' ? amount : mode === 'ADD' ? currentStock + amount : currentStock - amount;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-on-surface">Penyesuaian Stok</h2>
            <p className="text-sm text-on-surface-variant">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface" aria-label="Tutup">
            ✕
          </button>
        </div>

        <div className="mb-4 rounded-xl bg-surface-container-low p-3 text-sm text-on-surface-variant">
          Stok saat ini: <span className="font-mono font-bold text-on-surface">{currentStock} {product.unit}</span>
        </div>

        {/* Adjust form */}
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {([
              { v: 'ADD', l: 'Tambah' },
              { v: 'SUBTRACT', l: 'Kurangi' },
              { v: 'SET', l: 'Set Total' },
            ] as { v: AdjustMode; l: string }[]).map((opt) => (
              <button
                key={opt.v}
                onClick={() => setMode(opt.v)}
                className={`rounded-lg border px-2 py-2 text-sm font-semibold transition ${
                  mode === opt.v
                    ? 'border-primary bg-primary text-white'
                    : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={0}
            value={amount || ''}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
            placeholder="Jumlah"
            className="input"
          />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Catatan (opsional)"
            className="input"
          />
          <div className="text-sm text-on-surface-variant">
            Stok setelah penyesuaian:{' '}
            <span className={`font-mono font-bold ${preview < 0 ? 'text-error' : 'text-on-surface'}`}>
              {preview} {product.unit}
            </span>
          </div>
          {error && (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-error">{error}</div>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting || amount === 0}
            className="btn btn-primary w-full"
          >
            {submitting ? 'Menyimpan...' : 'Simpan Penyesuaian'}
          </button>
        </div>

        {/* Movement history */}
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-on-surface">Riwayat Pergerakan Stok</h3>
          {movements.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Belum ada pergerakan stok</p>
          ) : (
            <div className="max-h-52 space-y-2 overflow-y-auto">
              {movements.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between border-b border-outline-variant pb-1.5 text-sm"
                >
                  <div>
                    <span className={`pill ${TYPE_COLORS[m.type]}`}>
                      {TYPE_LABELS[m.type]}
                    </span>
                    {m.note && <span className="ml-2 text-xs text-on-surface-variant">{m.note}</span>}
                  </div>
                  <div className="text-right">
                    <span className={`font-mono font-semibold ${m.quantity >= 0 ? 'text-primary' : 'text-error'}`}>
                      {m.quantity >= 0 ? '+' : ''}{m.quantity}
                    </span>
                    <div className="font-mono text-xs text-on-surface-variant">
                      {m.stockBefore} → {m.stockAfter}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
