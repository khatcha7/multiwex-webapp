'use client';
import { createContext, useContext, useEffect, useState } from 'react';

const BookingContext = createContext(null);

const initialCart = {
  activityIds: [],
  players: 2,
  date: null,
  slots: {},
};

export function BookingProvider({ children }) {
  const [cart, setCart] = useState(initialCart);
  const [user, setUser] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const c = localStorage.getItem('mw_cart');
      if (c) setCart(JSON.parse(c));
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
    setCart((c) => ({
      ...c,
      activityIds: c.activityIds.includes(id)
        ? c.activityIds.filter((x) => x !== id)
        : [...c.activityIds, id],
      slots: Object.fromEntries(Object.entries(c.slots).filter(([k]) => k !== id)),
    }));

  const setPlayers = (n) => setCart((c) => ({ ...c, players: n }));
  const setDate = (d) => setCart((c) => ({ ...c, date: d, slots: {} }));
  const setSlot = (activityId, slot) =>
    setCart((c) => ({ ...c, slots: { ...c.slots, [activityId]: slot } }));
  const clearCart = () => setCart(initialCart);

  const saveBooking = (booking) => {
    const all = JSON.parse(localStorage.getItem('mw_bookings') || '[]');
    all.push(booking);
    localStorage.setItem('mw_bookings', JSON.stringify(all));
  };

  return (
    <BookingContext.Provider
      value={{ cart, setCart, toggleActivity, setPlayers, setDate, setSlot, clearCart, user, setUser, saveBooking, hydrated }}
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
