'use client';

import { createContext, useCallback, useContext, useState, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let counter = 0;

const STYLES: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: 'bg-green-600', icon: '✓' },
  error: { bg: 'bg-red-600', icon: '✕' },
  info: { bg: 'bg-blue-600', icon: 'ℹ' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = ++counter;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => remove(id), 3500);
    },
    [remove]
  );

  const success = useCallback((message: string) => showToast(message, 'success'), [showToast]);
  const error = useCallback((message: string) => showToast(message, 'error'), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-3 rounded-lg ${STYLES[t.type].bg} px-4 py-3 text-sm font-medium text-white shadow-lg`}
          >
            <span aria-hidden className="text-base">{STYLES[t.type].icon}</span>
            <span>{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className="ml-2 text-white/70 hover:text-white"
              aria-label="Tutup notifikasi"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
