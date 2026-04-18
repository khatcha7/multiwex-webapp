'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getActiveStaff, setActiveStaff, listStaffUsers, logAudit } from '@/lib/data';

export default function StaffLayout({ children }) {
  const [staff, setStaff] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setStaff(getActiveStaff());
    setHydrated(true);
  }, [pathname]);

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
  ];
  const can = (p) => staff?.permissions?.all || staff?.permissions?.[p];

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-40 border-b border-mw-pink/30 bg-mw-darker/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2">
          <nav className="flex flex-wrap items-center gap-1">
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
      </div>
      {children}
    </div>
  );
}
