'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useBooking } from '@/lib/store';
import { useState } from 'react';

export default function Header() {
  const { cart, user } = useBooking();
  const count = cart.activityIds.length;
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-mw-darker/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/images/brand/logo.png" alt="Multiwex" width={48} height={48} priority className="h-10 w-auto md:h-12" />
          <span className="hidden font-black tracking-tight text-white sm:block">MULTIWEX</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/" className="text-sm font-medium text-white/80 hover:text-mw-pink">Accueil</Link>
          <Link href="/booking" className="text-sm font-medium text-white/80 hover:text-mw-pink">Réserver</Link>
          <Link href="/giftcard" className="text-sm font-medium text-white/80 hover:text-mw-pink">🎁 Carte cadeau</Link>
          <Link href="/account" className="text-sm font-medium text-white/80 hover:text-mw-pink">Compte</Link>
          <Link href="/booking" className="btn-primary !py-2 !px-5 text-sm">
            Panier {count > 0 && <span className="ml-1 rounded-full bg-black/20 px-2 text-xs">{count}</span>}
          </Link>
        </nav>
        <button onClick={() => setOpen(!open)} className="md:hidden rounded-lg border border-white/15 p-2" aria-label="Menu">
          <div className="relative h-5 w-6">
            <span className={`absolute left-0 top-0.5 h-0.5 w-6 bg-white transition ${open ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`absolute left-0 top-2.5 h-0.5 w-6 bg-white transition ${open ? 'opacity-0' : ''}`} />
            <span className={`absolute left-0 top-4.5 h-0.5 w-6 bg-white transition ${open ? '-rotate-45 -translate-y-2' : ''}`} />
          </div>
        </button>
      </div>
      {open && (
        <div className="border-t border-white/10 bg-mw-darker md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            <Link href="/" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-white/90 hover:bg-white/5">Accueil</Link>
            <Link href="/booking" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-white/90 hover:bg-white/5">Réserver {count > 0 && <span className="ml-2 rounded-full bg-mw-pink px-2 text-xs font-bold text-white">{count}</span>}</Link>
            <Link href="/giftcard" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-white/90 hover:bg-white/5">🎁 Carte cadeau</Link>
            <Link href="/account" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-white/90 hover:bg-white/5">Compte</Link>
            <Link href="/admin" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-white/60 hover:bg-white/5 text-sm">Admin</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
