'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StaffHomePage() {
  const router = useRouter();
  useEffect(() => { router.replace('/staff/calendar'); }, [router]);
  return <div className="p-10 text-white/60">Redirection…</div>;
}
