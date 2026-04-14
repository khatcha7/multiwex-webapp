import './globals.css';
import { Archivo_Black, Montserrat } from 'next/font/google';
import { BookingProvider } from '@/lib/store';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Marquee from '@/components/Marquee';

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
      <body>
        <BookingProvider>
          <Marquee />
          <Header />
          <main className="min-h-[calc(100vh-180px)]">{children}</main>
          <Footer />
        </BookingProvider>
      </body>
    </html>
  );
}
