'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { getActivity } from './activities';

const BookingContext = createContext(null);

// Nouveau shape : un "item" par activité contient un tableau `sessions` où
// chaque session a son propre `players` et son propre `slot` (assignable
// indépendamment).
//
// cart.items = {
//   eyestart: { sessions: [{ players: 3 }, { players: 5 }, { players: 8 }] },
//   cube3:    { sessions: [{ players: 2 }, { players: 4 }] },
// }
// cart.slots = {
//   eyestart: [{ start: '14:00', end: '14:20' }, { start: '14:20', end: '14:40' }, ...]
// }  (indexé par position dans sessions)

const initialCart = {
  items: {},
  date: null,
  slots: {},
  packageId: null,
  packageMinPlayers: null,
  packageMaxPlayers: null,
  appliedPromoCode: null,
};

// Helpers computed
export function getMaxPlayers(cart) {
  let max = 0;
  Object.values(cart.items || {}).forEach((item) => {
    (item.sessions || []).forEach((s) => { if (s.players > max) max = s.players; });
  });
  return max || 2;
}

export function getTotalSessions(cart) {
  return Object.values(cart.items || {}).reduce(
    (acc, it) => acc + ((it.sessions || []).length),
    0
  );
}

export function BookingProvider({ children }) {
  const [cart, setCart] = useState(initialCart);
  const [user, setUser] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const c = localStorage.getItem('mw_cart_v3');
      if (c) {
        const parsed = JSON.parse(c);
        if (parsed && parsed.items) setCart(parsed);
      }
      const u = localStorage.getItem('mw_user');
      if (u) setUser(JSON.parse(u));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem('mw_cart_v3', JSON.stringify(cart));
  }, [cart, hydrated]);

  useEffect(() => {
    if (hydrated) {
      if (user) localStorage.setItem('mw_user', JSON.stringify(user));
      else localStorage.removeItem('mw_user');
    }
  }, [user, hydrated]);

  const setDate = (d) => setCart((c) => ({ ...c, date: d }));

  const toggleActivity = (id) => {
    const a = getActivity(id);
    if (!a) return;
    const defaultPlayers = Math.max(a.minPlayers || 1, 2);
    setCart((c) => {
      const next = { ...c.items };
      if (next[id]) delete next[id];
      else next[id] = { sessions: [{ players: Math.min(defaultPlayers, a.maxPlayers) }] };
      const nextSlots = { ...c.slots };
      if (!next[id]) delete nextSlots[id];
      return { ...c, items: next, slots: nextSlots };
    });
  };

  // Set the number of sessions (créneaux) demandés pour une activité
  const setSessionCount = (activityId, count) => {
    const a = getActivity(activityId);
    if (!a) return;
    setCart((c) => {
      const item = c.items[activityId] || { sessions: [] };
      const current = item.sessions || [];
      const next = [];
      for (let i = 0; i < count; i++) {
        next.push(current[i] || { players: Math.max(a.minPlayers || 1, 2) });
      }
      const newSlots = { ...c.slots };
      // Trunc slots si on réduit
      if (newSlots[activityId]) newSlots[activityId] = newSlots[activityId].slice(0, count);
      return {
        ...c,
        items: { ...c.items, [activityId]: { sessions: next } },
        slots: newSlots,
      };
    });
  };

  // Définit le nb de joueurs d'un créneau donné (index dans sessions)
  const setSessionPlayers = (activityId, sessionIndex, players) => {
    const a = getActivity(activityId);
    if (!a) return;
    const minP = a.minPlayers || 1;
    const clamped = Math.min(Math.max(minP, players), a.maxPlayers);
    setCart((c) => {
      const item = c.items[activityId];
      if (!item) return c;
      const sessions = item.sessions.slice();
      sessions[sessionIndex] = { ...sessions[sessionIndex], players: clamped };
      return { ...c, items: { ...c.items, [activityId]: { sessions } } };
    });
  };

  const assignSlot = (activityId, sessionIndex, slot) => {
    setCart((c) => {
      const arr = (c.slots[activityId] || []).slice();
      arr[sessionIndex] = slot;
      return { ...c, slots: { ...c.slots, [activityId]: arr } };
    });
  };

  const clearSlot = (activityId, sessionIndex) => {
    setCart((c) => {
      const arr = (c.slots[activityId] || []).slice();
      arr[sessionIndex] = null;
      return { ...c, slots: { ...c.slots, [activityId]: arr } };
    });
  };

  const applyPackage = (pkg) => {
    const items = {};
    (pkg.activities || []).forEach((a) => {
      if (a.external) return;
      const activityDef = getActivity(a.activityId);
      if (!activityDef) return;
      const defaultPlayers = Math.max(activityDef.minPlayers || 1, pkg.minPlayers || 2);
      items[a.activityId] = { sessions: [{ players: Math.min(defaultPlayers, activityDef.maxPlayers) }] };
    });
    setCart((c) => ({
      ...c,
      items,
      slots: {},
      packageId: pkg.id,
      packageMinPlayers: pkg.minPlayers || null,
      packageMaxPlayers: pkg.maxPlayers || null,
    }));
  };

  const clearCart = () => setCart(initialCart);

  const applyPromoCode = (code) => setCart((c) => ({ ...c, appliedPromoCode: code }));

  const saveBooking = (booking) => {
    const all = JSON.parse(localStorage.getItem('mw_bookings') || '[]');
    all.push(booking);
    localStorage.setItem('mw_bookings', JSON.stringify(all));
  };

  return (
    <BookingContext.Provider
      value={{
        cart,
        setCart,
        setDate,
        toggleActivity,
        setSessionCount,
        setSessionPlayers,
        assignSlot,
        clearSlot,
        applyPackage,
        applyPromoCode,
        clearCart,
        user,
        setUser,
        saveBooking,
        hydrated,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error('useBooking must be within BookingProvider');
  return ctx;
}
