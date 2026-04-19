'use client';
import { useEffect } from 'react';
import { initDataLayer } from '@/lib/data';

export default function DataInit() {
  useEffect(() => {
    initDataLayer().catch((e) => console.warn('[DataInit]', e));
  }, []);
  return null;
}
