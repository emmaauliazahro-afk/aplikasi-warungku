'use client';

import { useState, useEffect, FormEvent } from 'react';
import { ApiError } from '@/lib/api';
import {
  Product,
  Category,
  ProductInput,
  createProduct,
  updateProduct,
} from '@/lib/products';

interface Props {
  product: Product | null; // null = create mode
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY: ProductInput = {
  sku: '',
  name: '',
  purchasePrice: 0,
  sellingPrice: 0,
  stock: 0,
  minStock: 5,
  unit: 'pcs',
  categoryId: null,
};

export default function ProductFormModal({ product, categories, onClose, onSaved }: Props) {
  const [form, setForm] = useState<ProductInput>(EMPTY);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!product;

  useEffect(() => {
    if (product) {
      setForm({
        sku: product.sku ?? '',
        name: product.name,
        purchasePrice: product.purchasePrice,
        sellingPrice: product.sellingPrice,
        stock: product.stock,
        minStock: product.minStock,
        unit: product.unit,
        categoryId: product.categoryId,
      });
    } else {
      setForm(EMPTY);
    }
  }, [product]);

  function update<K extends keyof ProductInput>(key: K, value: ProductInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSubmitting(true);
    try {
      const payload: ProductInput = {
        ...form,
        sku: form.sku?.trim() ? form.sku.trim() : null,
        categoryId: form.categoryId || null,
      };
      if (isEdit) {
        await updateProduct(product!.id, payload);
      } else {
        await createProduct(payload);
      }
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
        setError('Gagal menyimpan produk');
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-on-surface">
            {isEdit ? 'Edit Produk' : 'Tambah Produk'}
          </h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface" aria-label="Tutup">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-error">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nama Produk" error={fieldErrors.name} required>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="input"
              placeholder="Contoh: Beras Premium 5kg"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="SKU (opsional)" error={fieldErrors.sku}>
              <input
                type="text"
                value={form.sku ?? ''}
                onChange={(e) => update('sku', e.target.value)}
                className="input"
                placeholder="BRS-001"
              />
            </Field>
            <Field label="Kategori">
              <select
                value={form.categoryId ?? ''}
                onChange={(e) => update('categoryId', e.target.value ? Number(e.target.value) : null)}
                className="input"
              >
                <option value="">Tanpa kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Harga Beli" error={fieldErrors.purchasePrice} required>
              <input
                type="number"
                min={0}
                required
                value={form.purchasePrice}
                onChange={(e) => update('purchasePrice', Number(e.target.value))}
                className="input"
              />
            </Field>
            <Field label="Harga Jual" error={fieldErrors.sellingPrice} required>
              <input
                type="number"
                min={0}
                required
                value={form.sellingPrice}
                onChange={(e) => update('sellingPrice', Number(e.target.value))}
                className="input"
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Stok" error={fieldErrors.stock} required>
              <input
                type="number"
                min={0}
                required
                value={form.stock}
                onChange={(e) => update('stock', Number(e.target.value))}
                className="input"
              />
            </Field>
            <Field label="Min. Stok" error={fieldErrors.minStock}>
              <input
                type="number"
                min={0}
                value={form.minStock}
                onChange={(e) => update('minStock', Number(e.target.value))}
                className="input"
              />
            </Field>
            <Field label="Satuan">
              <input
                type="text"
                value={form.unit}
                onChange={(e) => update('unit', e.target.value)}
                className="input"
                placeholder="pcs"
              />
            </Field>
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

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-on-surface-variant">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}
