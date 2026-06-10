'use client';

import { useState, useEffect, FormEvent } from 'react';
import { ApiError } from '@/lib/api';
import { Customer, CustomerInput, createCustomer, updateCustomer } from '@/lib/customers';

export default function CustomerFormModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CustomerInput>({ name: '', phone: '', address: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!customer;

  useEffect(() => {
    if (customer) {
      setForm({ name: customer.name, phone: customer.phone ?? '', address: customer.address ?? '' });
    } else {
      setForm({ name: '', phone: '', address: '' });
    }
  }, [customer]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSubmitting(true);
    try {
      const payload: CustomerInput = {
        name: form.name,
        phone: form.phone?.trim() || null,
        address: form.address?.trim() || null,
      };
      if (isEdit) await updateCustomer(customer!.id, payload);
      else await createCustomer(payload);
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.errors) {
          const fe: Record<string, string> = {};
          err.errors.forEach((e) => (fe[e.field] = e.message));
          setFieldErrors(fe);
        }
      } else {
        setError('Gagal menyimpan pelanggan');
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-on-surface">
            {isEdit ? 'Edit Pelanggan' : 'Tambah Pelanggan'}
          </h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface" aria-label="Tutup">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-error">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">
              Nama <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input"
              placeholder="Nama pelanggan"
            />
            {fieldErrors.name && <p className="mt-1 text-xs text-error">{fieldErrors.name}</p>}
          </div>
          <div>
            <label className="label">No. Telepon</label>
            <input
              type="text"
              value={form.phone ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="input"
              placeholder="08xxxxxxxxxx"
            />
          </div>
          <div>
            <label className="label">Alamat</label>
            <textarea
              value={form.address ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="input"
              rows={2}
              placeholder="Alamat pelanggan"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Batal
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
