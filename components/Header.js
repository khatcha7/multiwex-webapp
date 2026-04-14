'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useBooking } from '@/lib/store';
import { useState } from 'react';

const LANGUAGES = ['FR', 'EN', 'NL', 'DE'];

export default function Header() {
  const { cart } = useBooking();
  const count = Object.keys(cart.items || {}).length;
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState('FR');
  const [langOpen, setLangOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-mw-darker/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:py-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/images/brand/logo.png" alt="Multiwex" width={48} height={48} priority className="h-9 w-auto md:h-11" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden flex-1 items-center justify-center gap-6 lg:flex">
          <Link href="/#activities" className="display text-sm text-white/80 hover:text-mw-pink">Découvrez les activités</Link>
          <Link href="/#tarifs" className="display text-sm text-white/80 hover:text-mw-pink">Tarifs</Link>
          <Link href="/#horaires" className="display text-sm text-white/80 hover:text-mw-pink">Horaires</Link>
          <Link href="/brasserie" className="display text-sm text-white/80 hover:text-mw-pink">Brasserie</Link>
          <Link href="/packages" className="display text-sm text-white/80 hover:text-mw-pink">Groupes</Link>
          <a href="https://www.multiwex.be/fr/entreprises/" target="_blank" rel="noopener noreferrer" className="display text-sm text-white/80 hover:text-mw-pink">Entreprises</a>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/account"
            className="hidden items-center justify-center rounded-md border border-white/20 bg-white/5 p-2.5 transition hover:border-mw-pink hover:text-mw-pink sm:flex"
            aria-label="Mon compte"
            title="Mon compte"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </Link>
          <Link
            href="/giftcard"
            className="hidden items-center justify-center rounded-md border border-white/20 bg-white/5 p-2.5 transition hover:border-mw-pink hover:text-mw-pink sm:flex"
            aria-label="Carte cadeau"
            title="Carte cadeau"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 12v10H4V12" /><path d="M2 7h20v5H2z" /><path d="M12 22V7" /><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
            </svg>
          </Link>
          <Link
            href="/staff/login"
            className="hidden items-center justify-center rounded-md border border-white/20 bg-white/5 p-2.5 transition hover:border-mw-pink hover:text-mw-pink lg:flex"
            aria-label="Back-office"
            title="Back-office staff"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
          </Link>

          <Link href="/booking" className="btn-primary !py-2.5 !px-4 text-xs md:text-sm">
            Réserver
            {count > 0 && <span className="ml-1 rounded-full bg-black/30 px-2 py-0.5 text-[10px]">{count}</span>}
          </Link>

          <div className="relative hidden sm:block">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center justify-center rounded-md border border-white/20 bg-white/5 px-3 py-2.5 text-xs font-bold text-white transition hover:border-mw-pink"
            >
              {lang}
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-white/20 bg-mw-darker">
                {LANGUAGES.map((l) => (
                  <button
                    key={l}
                    onClick={() => { setLang(l); setLangOpen(false); }}
                    className={`block w-full px-4 py-2 text-left text-xs font-bold hover:bg-mw-pink hover:text-white ${l === lang ? 'text-mw-pink' : 'text-white'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setOpen(!open)} className="rounded-md border border-white/15 p-2 lg:hidden" aria-label="Menu">
            <div className="relative h-5 w-6">
              <span className={`absolute left-0 top-0.5 h-0.5 w-6 bg-white transition ${open ? 'translate-y-2 rotate-45' : ''}`} />
              <span className={`absolute left-0 top-2.5 h-0.5 w-6 bg-white transition ${open ? 'opacity-0' : ''}`} />
              <span className={`absolute left-0 top-[18px] h-0.5 w-6 bg-white transition ${open ? '-translate-y-2 -rotate-45' : ''}`} />
            </div>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-mw-darker lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            <Link href="/" onClick={() => setOpen(false)} className="display rounded-md px-3 py-3 text-sm text-white hover:bg-white/5">Accueil</Link>
            <Link href="/#activities" onClick={() => setOpen(false)} className="display rounded-md px-3 py-3 text-sm text-white hover:bg-white/5">Découvrez les activités</Link>
            <Link href="/packages" onClick={() => setOpen(false)} className="display rounded-md px-3 py-3 text-sm text-white hover:bg-white/5">Packages groupes</Link>
            <Link href="/brasserie" onClick={() => setOpen(false)} className="display rounded-md px-3 py-3 text-sm text-white hover:bg-white/5">Brasserie</Link>
            <a href="https://www.multiwex.be/fr/entreprises/" target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="display rounded-md px-3 py-3 text-sm text-white hover:bg-white/5">Entreprises ↗</a>
            <Link href="/giftcard" onClick={() => setOpen(false)} className="display rounded-md px-3 py-3 text-sm text-white hover:bg-white/5">🎁 Carte cadeau</Link>
            <Link href="/account" onClick={() => setOpen(false)} className="display rounded-md px-3 py-3 text-sm text-white hover:bg-white/5">Mon compte</Link>
            <Link href="/admin" onClick={() => setOpen(false)} className="display rounded-md px-3 py-3 text-sm text-white/60 hover:bg-white/5">Back-office</Link>
            <div className="mt-2 flex gap-2 px-3">
              {LANGUAGES.map((l) => (
                <button
                  key={l}
                  onClick={() => { setLang(l); setOpen(false); }}
                  className={`rounded-md border px-3 py-1.5 text-xs font-bold ${l === lang ? 'border-mw-pink bg-mw-pink text-white' : 'border-white/20 text-white/80'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
