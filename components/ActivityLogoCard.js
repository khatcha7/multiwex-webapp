'use client';
import Image from 'next/image';
import { getActivityPrice, isWednesdayDiscount } from '@/lib/activities';

export default function ActivityLogoCard({ activity, selected, onClick, badge, players, as = 'button', date }) {
  const Tag = as;
  const dayPrice = date ? getActivityPrice(activity, date) : null;
  const isWed = date && isWednesdayDiscount(date);
  return (
    <Tag
      onClick={onClick}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-gradient-to-br from-white/[0.06] to-white/[0.01] text-left backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-mw-pink ${
        selected ? 'border-mw-pink shadow-neon-pink' : 'border-white/10'
      }`}
    >
      <div className="absolute inset-0 opacity-30 transition group-hover:opacity-50">
        {activity.image && (
          <Image src={activity.image} alt="" fill sizes="(max-width: 640px) 50vw, 33vw" className="object-cover blur-[1px]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/80 to-black/95" />
      </div>

      {selected && (
        <div className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-mw-pink text-sm font-black text-white shadow-neon-pink">
          ✓
        </div>
      )}
      {badge && (
        <div className="absolute right-2 top-2 z-10 rounded-full bg-mw-red/90 px-2 py-0.5 text-[10px] font-bold text-white">
          {badge}
        </div>
      )}

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-2 pt-3 pb-2">
        <div className="relative h-10 w-full">
          <Image
            src={activity.logo}
            alt={activity.name}
            fill
            sizes="180px"
            className="object-contain [filter:drop-shadow(0_0_8px_rgba(255,0,125,0.35))]"
          />
        </div>
      </div>

      {players && (
        <div className="relative z-10 flex items-center justify-center gap-1 text-[10px] text-white/60">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          <span>max {activity.maxPlayers}</span>
        </div>
      )}

      {activity.bookable && (
        <div className="relative z-10 flex items-center justify-center gap-2 border-t border-white/10 bg-black/40 px-3 py-2 text-center">
          {dayPrice != null ? (
            <>
              {isWed ? (
                <>
                  <div className="text-[10px] text-white/50 line-through">{activity.priceRegular}€</div>
                  <div className="display text-base text-white">{dayPrice}€</div>
                  <span className="text-[9px] font-bold text-mw-pink">-50%</span>
                </>
              ) : (
                <div className="display text-base text-white">{dayPrice}€</div>
              )}
              <span className="text-[9px] text-white/40">· {activity.minPlayers}-{activity.maxPlayers} joueurs</span>
            </>
          ) : (
            <>
              <div className="text-sm font-black text-white">{activity.priceRegular}€</div>
              <span className="text-xs text-white/40">·</span>
              <div className="text-xs font-bold text-mw-pink">{activity.priceWed}€ mer</div>
            </>
          )}
        </div>
      )}
      {!activity.bookable && (
        <div className="relative z-10 border-t border-white/10 bg-black/40 px-3 py-2 text-center text-[11px] font-bold text-white/70">
          {activity.walkIn ? 'Sans réservation' : 'Réservation externe ↗'}
        </div>
      )}
    </Tag>
  );
}
