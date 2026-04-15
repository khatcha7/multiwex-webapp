'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/booking');
  }, [router]);
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center text-white/60">
      Redirection vers le module de réservation…
    </div>
  );
}
