'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { getActivity } from '@/lib/activities';

export default function InvitePage() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    // Cherche la réservation dans localStorage (en prod: API)
    const all = JSON.parse(localStorage.getItem('mw_bookings') || '[]');
    const found = all.find((b) => (b.id || b.reference) === id);
    if (found) setBooking(found);
  }, [id]);

  if (!booking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mw-bg p-4">
        <div className="text-center text-white/60">
          <div className="display text-2xl mb-2">Réservation introuvable</div>
          <div className="text-sm">Vérifiez le lien ou contactez l'organisateur.</div>
        </div>
      </div>
    );
  }

  const dateStr = new Date(booking.date).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-mw-bg p-4">
      <div className="w-full max-w-md">
        <div className="rounded border border-mw-pink/40 bg-gradient-to-br from-mw-pink/15 via-mw-surface to-mw-surface overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#ff0040] to-[#e8005a] px-6 py-5 text-center">
            <Image src="/images/brand/logo.png" alt="Multiwex" width={48} height={48} className="mx-auto mb-2 h-10 w-auto" />
            <div className="display text-2xl text-white">Vous êtes invité !</div>
          </div>

          {/* Contenu */}
          <div className="p-6">
            <div className="mb-4 text-center">
              <div className="text-xs uppercase tracking-wider text-white/50">Organisé par</div>
              <div className="display text-xl text-mw-pink">{booking.customer?.firstName || booking.customer?.name || 'Un ami'}</div>
            </div>

            <div className="mb-4 rounded border border-white/10 bg-white/[0.02] p-4 text-center">
              <div className="display text-lg">{dateStr}</div>
              <div className="text-sm text-white/60">{booking.players || 0} joueurs</div>
            </div>

            <div className="space-y-2">
              {(booking.items || []).map((item, idx) => {
                const act = getActivity(item.activityId);
                return (
                  <div key={idx} className="flex items-center gap-3 rounded bg-white/[0.03] p-3">
                    {act && (
                      <div className="relative h-8 w-8 shrink-0">
                        <Image src={act.logo} alt="" fill sizes="32px" className="object-contain" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="display text-sm">{item.activityName || act?.name}</div>
                      <div className="text-[11px] text-white/50">{item.players || '?'} joueurs</div>
                    </div>
                    <div className="font-mono text-mw-pink">{item.start}</div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded border border-white/10 bg-white/[0.02] p-3 text-center text-xs text-white/50">
              <div>Multiwex · Rue des Deux Provinces 1</div>
              <div>6900 Marche-en-Famenne · +32 (0)84 770 222</div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-[10px] text-white/30">Réf. {booking.id || booking.reference}</p>
      </div>
    </div>
  );
}
