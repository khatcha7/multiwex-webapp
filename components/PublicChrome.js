'use client';
import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Marquee from '@/components/Marquee';
import ChatWidget from '@/components/ChatWidget';

export function PublicTop() {
  const pathname = usePathname() || '';
  if (pathname.startsWith('/staff')) return null;
  return (
    <>
      <Marquee />
      <Header />
    </>
  );
}

export function PublicFooter() {
  const pathname = usePathname() || '';
  if (pathname.startsWith('/staff')) return null;
  return (
    <>
      <Footer />
      <ChatWidget />
    </>
  );
}
