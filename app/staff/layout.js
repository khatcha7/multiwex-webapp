'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getActiveStaff, setActiveStaff, listStaffUsers, logAudit } from '@/lib/data';

export default function StaffLayout({ children }) {
  const [staff, setStaff] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setStaff(getActiveStaff());
    setHydrated(true);
  }, [pathname]);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const logout = () => {
    if (staff) logAudit({ action: 'logout', entityType: 'staff_session', entityId: staff.id });
    setActiveStaff(null);
    setStaff(null);
    router.push('/staff/login');
  };

  if (!hydrated) return <div className="p-10 text-white/60">Chargement…</div>;

  if (!staff && pathname !== '/staff/login') {
    if (typeof window !== 'undefined') router.push('/staff/login');
    return null;
  }

  if (pathname === '/staff/login') return children;

  const tabs = [
    { href: '/staff/calendar', label: 'Calendrier', perm: 'calendar' },
    { href: '/staff/bookings', label: 'Réservations', perm: 'bookings_view' },
    { href: '/staff/on-site', label: 'Sur place', perm: 'on_site_booking' },
    { href: '/staff/reports', label: 'Reports', perm: 'financial_reports' },
    { href: '/staff/settings', label: 'Réglages', perm: 'settings' },
    { href: '/staff/users', label: 'Équipe', perm: 'users_manage' },
    { href: '/staff/notes', label: 'Notes', perm: 'calendar' },
  ];
  const can = (p) => staff?.permissions?.all || staff?.permissions?.[p];

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-40 border-b border-mw-pink/30 bg-mw-darker/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2">
          {/* Mobile : burger + active label */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
              className="flex h-8 w-8 items-center justify-center rounded-md text-white/80 hover:bg-white/10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {menuOpen ? <><path d="M18 6L6 18"/><path d="M6 6l12 12"/></> : <><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></>}
              </svg>
            </button>
            <Link href="/" title="Retour au site client" className="flex h-8 w-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/></svg>
            </Link>
            <span className="display text-xs text-white">
              {tabs.find((t) => pathname.startsWith(t.href))?.label || ''}
            </span>
          </div>

          {/* Desktop : nav inline */}
          <nav className="hidden md:flex flex-wrap items-center gap-1">
            <Link
              href="/"
              title="Retour au site client"
              className="display flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/></svg>
            </Link>
            {tabs.filter((t) => can(t.perm)).map((t) => {
              const active = pathname.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`display shrink-0 rounded-md px-3 py-1.5 text-xs transition ${
                    active ? 'bg-mw-pink text-white' : 'text-white/70 hover:bg-white/10'
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden text-white/60 md:inline">👤 {staff?.name}</span>
            <button onClick={logout} className="display text-white/60 hover:text-mw-red">Déco</button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/10 bg-mw-darker/98 px-3 py-2">
            <nav className="flex flex-col gap-1">
              {tabs.filter((t) => can(t.perm)).map((t) => {
                const active = pathname.startsWith(t.href);
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={`display rounded-md px-3 py-2 text-sm transition ${
                      active ? 'bg-mw-pink text-white' : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    {t.label}
                  </Link>
                );
              })}
              {staff?.name && (
                <div className="mt-1 border-t border-white/10 px-3 pt-2 text-xs text-white/50">👤 {staff.name}</div>
              )}
            </nav>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
