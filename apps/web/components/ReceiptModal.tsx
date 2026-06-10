'use client';

import { Transaction } from '@/lib/transactions';
import { formatRupiah } from '@/lib/format';

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Tunai',
  TRANSFER: 'Transfer',
  DEBT: 'Hutang/Bon',
};

export default function ReceiptModal({
  transaction,
  onClose,
}: {
  transaction: Transaction;
  onClose: () => void;
}) {
  function handlePrint() {
    window.print();
  }

  const date = new Date(transaction.createdAt).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        {/* Printable area */}
        <div id="receipt" className="p-6 font-mono">
          <div className="mb-4 text-center">
            <h2 className="font-sans text-lg font-bold text-on-surface">WarungKu</h2>
            <p className="text-xs text-on-surface-variant">Struk Pembelian</p>
          </div>

          <div className="mb-3 border-b border-dashed border-outline-variant pb-2 text-xs text-on-surface-variant">
            <div className="flex justify-between">
              <span>No.</span>
              <span className="font-semibold">{transaction.transactionNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Tanggal</span>
              <span>{date}</span>
            </div>
            {transaction.customer && (
              <div className="flex justify-between">
                <span>Pelanggan</span>
                <span>{transaction.customer.name}</span>
              </div>
            )}
          </div>

          <table className="mb-3 w-full text-xs">
            <tbody>
              {transaction.items?.map((it) => (
                <tr key={it.id}>
                  <td className="py-1 align-top text-on-surface">
                    {it.productName}
                    <div className="text-on-surface-variant">
                      {it.quantity} x {formatRupiah(it.price)}
                    </div>
                  </td>
                  <td className="py-1 text-right align-top font-semibold text-on-surface">
                    {formatRupiah(it.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-dashed border-outline-variant pt-2 text-xs text-on-surface-variant">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatRupiah(transaction.subtotal)}</span>
            </div>
            {transaction.discount > 0 && (
              <div className="flex justify-between">
                <span>Diskon</span>
                <span>-{formatRupiah(transaction.discount)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between text-sm font-bold text-on-surface">
              <span>Total</span>
              <span>{formatRupiah(transaction.totalAmount)}</span>
            </div>
            <div className="mt-2 flex justify-between">
              <span>Metode</span>
              <span>{PAYMENT_LABELS[transaction.paymentMethod]}</span>
            </div>
            {transaction.paymentMethod === 'CASH' && (
              <>
                <div className="flex justify-between">
                  <span>Bayar</span>
                  <span>{formatRupiah(transaction.paidAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kembali</span>
                  <span>{formatRupiah(transaction.changeAmount)}</span>
                </div>
              </>
            )}
            {transaction.paymentMethod === 'DEBT' && transaction.debt && (
              <div className="flex justify-between font-semibold text-debt">
                <span>Sisa Hutang</span>
                <span>{formatRupiah(transaction.debt.remaining)}</span>
              </div>
            )}
          </div>

          <p className="mt-4 text-center font-sans text-xs text-on-surface-variant">
            Terima kasih telah berbelanja 🙏
          </p>
        </div>

        <div className="flex gap-3 border-t border-outline-variant p-4 print:hidden">
          <button onClick={handlePrint} className="btn btn-ghost flex-1">
            🖨 Cetak
          </button>
          <button onClick={onClose} className="btn btn-primary flex-1">
            Transaksi Baru
          </button>
        </div>
      </div>
    </div>
  );
}
