'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { getActivity } from './activities';

const BookingContext = createContext(null);

const initialCart = {
  items: {},
  players: 2,
  date: null,
  slots: {},
};

export function computeSessionsNeeded(activity, players, userQuantity = 1) {
  if (!activity || !activity.bookable) return 0;
  const byCapacity = Math.ceil(players / activity.maxPlayers);
  return Math.max(byCapacity, userQuantity);
}

export function BookingProvider({ children }) {
  const [cart, setCart] = useState(initialCart);
  const [user, setUser] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const c = localStorage.getItem('mw_cart');
      if (c) {
        const parsed = JSON.parse(c);
        if (parsed && parsed.items && typeof parsed.items === 'object' && !Array.isArray(parsed.items)) {
          setCart(parsed);
        }
      }
      const u = localStorage.getItem('mw_user');
      if (u) setUser(JSON.parse(u));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem('mw_cart', JSON.stringify(cart));
  }, [cart, hydrated]);

  useEffect(() => {
    if (hydrated) {
      if (user) localStorage.setItem('mw_user', JSON.stringify(user));
      else localStorage.removeItem('mw_user');
    }
  }, [user, hydrated]);

  const toggleActivity = (id) =>
    setCart((c) => {
      const next = { ...c.items };
      if (next[id]) delete next[id];
      else next[id] = { quantity: 1 };
      const nextSlots = { ...c.slots };
      if (!next[id]) delete nextSlots[id];
      return { ...c, items: next, slots: nextSlots };
    });

  const applyPackage = (pkg) => {
    const items = {};
    (pkg.activities || []).forEach((a) => {
      if (a.external) return;
      items[a.activityId] = { quantity: 1 };
    });
    setCart((c) => ({ ...c, items, slots: {}, packageId: pkg.id, players: Math.max(c.players, pkg.minPlayers || c.players) }));
  };

  const setItemQuantity = (id, qty) =>
    setCart((c) => ({
      ...c,
      items: { ...c.items, [id]: { ...(c.items[id] || {}), quantity: Math.max(1, qty) } },
      slots: { ...c.slots, [id]: [] },
    }));

  const setPlayers = (n) => setCart((c) => ({ ...c, players: n }));
  const setDate = (d) => setCart((c) => ({ ...c, date: d, slots: {} }));
  const setActivitySlots = (activityId, slotArray) =>
    setCart((c) => ({ ...c, slots: { ...c.slots, [activityId]: slotArray } }));
  const clearCart = () => setCart(initialCart);

  const saveBooking = (booking) => {
    const all = JSON.parse(localStorage.getItem('mw_bookings') || '[]');
    all.push(booking);
    localStorage.setItem('mw_bookings', JSON.stringify(all));
  };

  const getActivityIds = () => Object.keys(cart.items);

  const getTotalSessions = (activityId) => {
    const item = cart.items[activityId];
    if (!item) return 0;
    const activity = getActivity(activityId);
    return computeSessionsNeeded(activity, cart.players, item.quantity);
  };

  return (
    <BookingContext.Provider
      value={{
        cart,
        setCart,
        toggleActivity,
        applyPackage,
        setItemQuantity,
        setPlayers,
        setDate,
        setActivitySlots,
        clearCart,
        user,
        setUser,
        saveBooking,
        hydrated,
        getActivityIds,
        getTotalSessions,
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
