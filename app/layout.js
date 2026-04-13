import './globals.css';
import { BookingProvider } from '@/lib/store';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

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
    <html lang="fr">
      <body>
        <BookingProvider>
          <Header />
          <main className="min-h-[calc(100vh-140px)]">{children}</main>
          <Footer />
        </BookingProvider>
      </body>
    </html>
  );
}
