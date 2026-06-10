'use client';

import { useState, useRef } from 'react';
import {
  importProducts,
  downloadTemplate,
  ImportResult,
} from '@/lib/products';

interface Props {
  onClose: () => void;
  onImported: () => void;
}

export default function ImportModal({ onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleImport() {
    if (!file) return;
    setUploading(true);
    setError('');
    setResult(null);
    try {
      const res = await importProducts(file);
      setResult(res);
      if (res.created > 0) onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengimpor');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-on-surface">Import Produk dari CSV</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface" aria-label="Tutup">
            ✕
          </button>
        </div>

        <div className="mb-4 rounded-xl bg-secondary-fixed/60 p-3 text-sm text-on-secondary-container" style={{ backgroundColor: '#e7f1f8' }}>
          <p className="font-semibold">Petunjuk:</p>
          <ol className="ml-4 mt-1 list-decimal space-y-0.5 text-xs">
            <li>Unduh template CSV di bawah ini</li>
            <li>Isi data produk sesuai kolom (kolom sku &amp; category boleh kosong)</li>
            <li>Unggah file CSV yang sudah diisi</li>
          </ol>
          <button
            onClick={() => downloadTemplate().catch(() => setError('Gagal mengunduh template'))}
            className="mt-2 font-semibold text-secondary underline hover:opacity-80"
          >
            ⬇ Unduh Template CSV
          </button>
        </div>

        {/* File picker */}
        <div
          onClick={() => inputRef.current?.click()}
          className="cursor-pointer rounded-xl border-2 border-dashed border-outline-variant p-6 text-center hover:border-primary"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
            }}
          />
          {file ? (
            <p className="text-sm font-medium text-on-surface">📄 {file.name}</p>
          ) : (
            <p className="text-sm text-on-surface-variant">Klik untuk memilih file CSV</p>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-error">{error}</div>
        )}

        {/* Result summary */}
        {result && (
          <div className="mt-4 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 rounded-xl p-3 text-center" style={{ backgroundColor: '#e7f7ef' }}>
                <div className="font-mono text-2xl font-bold text-primary">{result.created}</div>
                <div className="label-caps">Berhasil</div>
              </div>
              <div className="flex-1 rounded-xl bg-red-50 p-3 text-center">
                <div className="font-mono text-2xl font-bold text-error">{result.failedCount}</div>
                <div className="label-caps">Gagal</div>
              </div>
              <div className="flex-1 rounded-xl bg-surface-container-low p-3 text-center">
                <div className="font-mono text-2xl font-bold text-on-surface">{result.totalRows}</div>
                <div className="label-caps">Total Baris</div>
              </div>
            </div>

            {result.failed.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-outline-variant">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container-low text-on-surface-variant">
                    <tr>
                      <th className="px-3 py-2">Baris</th>
                      <th className="px-3 py-2">Nama</th>
                      <th className="px-3 py-2">Kesalahan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {result.failed.map((f, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-on-surface-variant">{f.row}</td>
                        <td className="px-3 py-2 text-on-surface-variant">{f.name || '-'}</td>
                        <td className="px-3 py-2 text-error">{f.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="btn btn-ghost">
            {result ? 'Tutup' : 'Batal'}
          </button>
          {!result && (
            <button onClick={handleImport} disabled={!file || uploading} className="btn btn-primary">
              {uploading ? 'Mengimpor...' : 'Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
