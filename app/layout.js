import './globals.css';
import { Archivo_Black, Montserrat } from 'next/font/google';
import { BookingProvider } from '@/lib/store';
import { PublicTop, PublicFooter } from '@/components/PublicChrome';
import DataInit from '@/components/DataInit';

const display = Archivo_Black({ subsets: ['latin'], weight: '400', variable: '--font-display', display: 'swap' });
const body = Montserrat({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata = {
  title: 'Multiwex — Réservez vos activités',
  description: 'Centre de loisirs Multiwex à Marche-en-Famenne. Réservez en ligne vos activités : EyeStart, DarkDrift, K7 Karaoké, Slash and Hit et plus.',
};

export const viewport = {
  themeColor: '#00D9FF',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable}`}>
      <body className="flex min-h-screen flex-col">
        <BookingProvider>
          <DataInit />
          <PublicTop />
          <main className="flex-1">{children}</main>
          <PublicFooter />
        </BookingProvider>
      </body>
    </html>
  );
}
