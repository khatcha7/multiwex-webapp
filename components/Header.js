'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

const LANGUAGES = ['FR', 'EN', 'NL', 'DE'];

export default function Header() {
  const [lang, setLang] = useState('FR');
  const [langOpen, setLangOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-mw-bg/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:py-4">
        <Link href="/booking" className="flex items-center gap-2 shrink-0">
          <Image src="/images/brand/logo.png" alt="Multiwex" width={48} height={48} priority className="h-9 w-auto md:h-11" />
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/giftcard"
            className="flex items-center justify-center rounded border border-white/20 bg-white/[0.03] p-2.5 transition hover:border-mw-pink hover:text-mw-pink"
            aria-label="Carte cadeau"
            title="Carte cadeau"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 12v10H4V12" /><path d="M2 7h20v5H2z" /><path d="M12 22V7" /><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
            </svg>
          </Link>

          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center justify-center rounded border border-white/20 bg-white/[0.03] px-3 py-2.5 text-xs font-bold text-white transition hover:border-mw-pink"
            >
              {lang}
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 overflow-hidden rounded border border-white/20 bg-mw-surface">
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

          <Link
            href="/staff/login"
            className="flex items-center justify-center rounded border border-white/15 bg-white/[0.02] p-2.5 text-white/40 transition hover:border-mw-pink hover:text-mw-pink"
            aria-label="Back-office"
            title="Back-office (temporaire, sera masqué en prod)"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
