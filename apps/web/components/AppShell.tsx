'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type IconName =
  | 'dashboard'
  | 'kasir'
  | 'produk'
  | 'stok'
  | 'pelanggan'
  | 'hutang'
  | 'laporan';

function NavIcon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    viewBox: '0 0 24 24',
    className,
  };
  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
      );
    case 'kasir':
      return (
        <svg {...common}><rect x="3" y="8" width="18" height="12" rx="2" /><path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" /><path d="M7 12h10M7 16h6" /></svg>
      );
    case 'produk':
      return (
        <svg {...common}><path d="M21 8 12 3 3 8l9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="m12 13 0 8" /></svg>
      );
    case 'stok':
      return (
        <svg {...common}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3v2h6V3" /><path d="m8.5 12 2 2 4-4" /></svg>
      );
    case 'pelanggan':
      return (
        <svg {...common}><circle cx="9" cy="8" r="3.5" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.5a3.5 3.5 0 0 1 0 7M21 20a6 6 0 0 0-5-5.9" /></svg>
      );
    case 'hutang':
      return (
        <svg {...common}><rect x="2.5" y="6" width="19" height="13" rx="2.5" /><path d="M2.5 10h19" /><path d="M6 15h4" /></svg>
      );
    case 'laporan':
      return (
        <svg {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
      );
  }
}

const NAV_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/kasir', label: 'Kasir', icon: 'kasir' },
  { href: '/produk', label: 'Produk', icon: 'produk' },
  { href: '/stok', label: 'Stok', icon: 'stok' },
  { href: '/pelanggan', label: 'Pelanggan', icon: 'pelanggan' },
  { href: '/hutang', label: 'Hutang', icon: 'hutang' },
  { href: '/laporan', label: 'Laporan', icon: 'laporan' },
];

function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 transform flex-col border-r border-outline-variant bg-white transition-transform duration-200 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-6 pt-6 pb-4">
          <div className="text-2xl font-bold tracking-tight text-primary">WarungKu</div>
          <div className="text-sm text-on-surface-variant">Admin Kasir</div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-[0.95rem] font-medium transition ${
                  active
                    ? 'bg-secondary-container text-on-secondary-container font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-outline-variant p-4">
          <Link
            href="/kasir"
            onClick={() => setMobileOpen(false)}
            className="btn btn-primary w-full"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Buka Shift Baru
          </Link>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col md:pl-64">
        <header className="sticky top-0 z-10 flex h-[4.5rem] items-center gap-3 border-b border-outline-variant bg-white px-4 md:px-6">
          <button
            className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Buka menu"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>

          {/* Search (decorative) */}
          <div className="relative hidden max-w-xl flex-1 sm:block">
            <svg className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
            <input
              type="search"
              placeholder="Cari transaksi atau produk..."
              className="w-full rounded-full border border-transparent bg-surface-container-low py-2.5 pl-11 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:bg-white focus:outline-none"
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* User menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-3 rounded-full py-1 pl-3 pr-1 transition hover:bg-surface-container-low"
              >
                <div className="hidden text-right leading-tight sm:block">
                  <div className="text-sm font-semibold text-on-surface">{user?.name}</div>
                  <div className="label-caps">{user?.role}</div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                  {initials(user?.name)}
                </div>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-outline-variant bg-white py-1 shadow-lg">
                  <div className="border-b border-outline-variant px-4 py-2 sm:hidden">
                    <div className="text-sm font-semibold text-on-surface">{user?.name}</div>
                    <div className="label-caps">{user?.role}</div>
                  </div>
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-danger hover:bg-surface-container-low"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
                    Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
