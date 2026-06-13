'use client';

import { useEffect, useState } from 'react';
import { createCashier, getSettings, listCashiers, updateSettings, type OwnerInfo } from '@/lib/settings';
import Spinner from '@/components/Spinner';
import { useToast } from '@/contexts/ToastContext';
import { ApiError } from '@/lib/api';

export default function SettingPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [cashierName, setCashierName] = useState('');
  const [cashierEmail, setCashierEmail] = useState('');
  const [cashierPassword, setCashierPassword] = useState('');
  const [cashiers, setCashiers] = useState<OwnerInfo[]>([]);

  useEffect(() => {
    Promise.all([getSettings(), listCashiers()])
      .then(([{ settings }, { cashiers }]) => {
        setStoreName(settings.storeName);
        setOwnerName(settings.owner.name);
        setOwnerEmail(settings.owner.email);
        setCashiers(cashiers);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat setting'))
      .finally(() => setLoading(false));
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await updateSettings({ storeName, ownerName, ownerEmail });
      toast.success('Setting tersimpan');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan setting');
    } finally {
      setSaving(false);
    }
  }

  async function onAddCashier(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setAdding(true);
    try {
      const { user } = await createCashier({ name: cashierName, email: cashierEmail, password: cashierPassword });
      setCashiers((prev) => [user, ...prev]);
      setCashierName('');
      setCashierEmail('');
      setCashierPassword('');
      toast.success('Kasir berhasil ditambahkan');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menambahkan kasir');
    } finally {
      setAdding(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-on-surface">Setting</h1>
        <p className="mt-1 text-on-surface-variant">Kelola identitas warung, owner, dan akun kasir.</p>
      </div>
      {error && <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-error">{error}</div>}
      <form onSubmit={onSave} className="card space-y-4 p-6">
        <h2 className="text-xl font-semibold text-on-surface">Informasi Warung</h2>
        <div><label className="label-caps mb-2 block">Nama Warung</label><input className="input" value={storeName} onChange={(e) => setStoreName(e.target.value)} required minLength={2} /></div>
        <div><label className="label-caps mb-2 block">Nama Owner</label><input className="input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required minLength={2} /></div>
        <div><label className="label-caps mb-2 block">Email Owner</label><input className="input" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required /></div>
        <button className="btn btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Setting'}</button>
      </form>
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={onAddCashier} className="card space-y-4 p-6">
          <h2 className="text-xl font-semibold text-on-surface">Tambah Kasir</h2>
          <div><label className="label-caps mb-2 block">Nama Kasir</label><input className="input" value={cashierName} onChange={(e) => setCashierName(e.target.value)} required minLength={2} /></div>
          <div><label className="label-caps mb-2 block">Email Kasir</label><input className="input" type="email" value={cashierEmail} onChange={(e) => setCashierEmail(e.target.value)} required /></div>
          <div><label className="label-caps mb-2 block">Password</label><input className="input" type="password" value={cashierPassword} onChange={(e) => setCashierPassword(e.target.value)} required minLength={8} /><p className="mt-1 text-xs text-on-surface-variant">Minimal 8 karakter, mengandung huruf dan angka.</p></div>
          <button className="btn btn-secondary" disabled={adding}>{adding ? 'Menambahkan...' : 'Tambah Kasir'}</button>
        </form>

        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-on-surface">Daftar Kasir</h2>
            <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-on-surface-variant">{cashiers.length} akun</span>
          </div>
          {cashiers.length === 0 ? (
            <p className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">Belum ada akun kasir.</p>
          ) : (
            <div className="divide-y divide-outline-variant">
              {cashiers.map((cashier) => (
                <div key={cashier.id} className="flex items-center gap-3 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed text-sm font-bold text-primary">
                    {cashier.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-on-surface">{cashier.name}</div>
                    <div className="truncate text-sm text-on-surface-variant">{cashier.email}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
