'use client';

import { useState, useEffect, useCallback } from 'react';
import { Customer, listCustomers, deleteCustomer } from '@/lib/customers';
import { formatRupiah } from '@/lib/format';
import Spinner from '@/components/Spinner';
import { ApiError } from '@/lib/api';
import CustomerFormModal from '@/components/CustomerFormModal';
import CustomerDetailModal from '@/components/CustomerDetailModal';
import { useToast } from '@/contexts/ToastContext';

const AVATAR_COLORS = [
  'bg-secondary-container text-on-secondary-container',
  'bg-rose-200 text-rose-800',
  'bg-primary-fixed text-on-primary-fixed',
  'bg-amber-200 text-amber-800',
  'bg-[#ddd0fb] text-debt',
];
function initials(name: string) {
  return name.split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

export default function PelangganPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCustomers(debouncedSearch || undefined);
      setCustomers(data);
    } catch {
      setError('Gagal memuat pelanggan');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  function handleSaved() {
    setShowForm(false);
    setEditing(null);
    toast.success(editing ? 'Pelanggan berhasil diperbarui' : 'Pelanggan berhasil ditambahkan');
    fetchCustomers();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    setError('');
    try {
      await deleteCustomer(deleting.id);
      toast.success(`${deleting.name} berhasil dihapus`);
      setDeleting(null);
      fetchCustomers();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Gagal menghapus pelanggan';
      toast.error(msg);
      setError(msg);
      setDeleting(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">Manajemen Pelanggan</h1>
          <p className="mt-1 text-on-surface-variant">Kelola data pelanggan dan pantau hutang mereka.</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="btn btn-primary"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Tambah Pelanggan
        </button>
      </div>

      <div className="card p-4">
        <div className="relative sm:max-w-md">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama pelanggan..."
            className="input pl-11"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-error">{error}</div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-outline-variant bg-surface-container-low">
              <tr className="[&>th]:px-5 [&>th]:py-3.5">
                <th><span className="label-caps">Nama</span></th>
                <th><span className="label-caps">Telepon</span></th>
                <th className="text-right"><span className="label-caps">Total Hutang</span></th>
                <th className="text-center"><span className="label-caps">Transaksi</span></th>
                <th className="text-center"><span className="label-caps">Aksi</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-6"><Spinner /></td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-on-surface-variant">Belum ada pelanggan</td></tr>
              ) : (
                customers.map((c, i) => (
                  <tr key={c.id} className="transition hover:bg-surface-container-low">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                          {initials(c.name)}
                        </div>
                        <div className="min-w-0">
                          <button onClick={() => setDetailId(c.id)} className="font-semibold text-on-surface hover:text-primary hover:underline">
                            {c.name}
                          </button>
                          {c.address && <div className="truncate text-xs text-on-surface-variant">{c.address}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-on-surface-variant">{c.phone ?? '-'}</td>
                    <td className="px-5 py-4 text-right">
                      <span className={`font-mono font-semibold ${(c.totalDebt ?? 0) > 0 ? 'text-debt' : 'text-on-surface-variant'}`}>
                        {formatRupiah(c.totalDebt ?? 0)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center font-mono text-on-surface-variant">{c.transactionCount ?? 0}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => { setEditing(c); setShowForm(true); }}
                          aria-label="Edit"
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-secondary-fixed hover:text-secondary"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                        </button>
                        <button
                          onClick={() => setDeleting(c)}
                          aria-label="Hapus"
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-red-50 hover:text-danger"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <CustomerFormModal customer={editing} onClose={() => setShowForm(false)} onSaved={handleSaved} />
      )}
      {detailId !== null && (
        <CustomerDetailModal customerId={detailId} onClose={() => setDetailId(null)} />
      )}
      {deleting && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-on-surface">Hapus Pelanggan?</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Anda yakin ingin menghapus <strong>{deleting.name}</strong>?
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setDeleting(null)} className="btn btn-ghost">Batal</button>
              <button onClick={confirmDelete} disabled={deleteLoading} className="btn btn-danger">
                {deleteLoading ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
