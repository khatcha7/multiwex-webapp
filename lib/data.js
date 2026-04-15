'use client';
// Data layer universel — routage Supabase ↔ localStorage fallback.
// Tous les composants UI passent par ce module, jamais directement par supabase
// ou localStorage. Permet de switcher l'un pour l'autre sans toucher l'UI.

import { supabase, isSupabaseConfigured } from './supabase';
import { getActivity, activities } from './activities';
import { getFakeOccupiedSlots } from './hours';

const LS = {
  bookings: 'mw_bookings',
  fakeBookings: 'mw_fake_bookings_v3',
  giftcards: 'mw_giftcards',
  slotBlocks: 'mw_slot_blocks',
  slotNotes: 'mw_slot_notes',
  auditLog: 'mw_audit_log',
  staffUsers: 'mw_staff_users',
  activeStaff: 'mw_active_staff',
  config: 'mw_site_config',
  popups: 'mw_popups',
};

const defaultConfig = {
  'site.tagline': "Choisissez vos activités, on s'occupe du reste.",
  'site.flash_sale_text': 'MERCREDI -50% SUR TOUTES LES ACTIVITÉS',
  'booking.buffer_min': 0,
  'booking.cancel_cutoff_hours': 24,
  'booking.join_cutoff_min': 10,
  'booking.bypass_package_toggle': false,
  'promo.demo_code': 'DEMO100',
  'contact.phone': '+32 (0)84 770 222',
  'contact.email': 'info@multiwex.be',
};

const defaultPopups = [
  {
    id: 'popup-upsell',
    title: 'Encore 10 min pour en profiter !',
    body: "Ajoutez une ou plusieurs activités à votre réservation et bénéficiez d'une réduction exclusive de 20% sur les nouvelles activités.",
    emoji: '⚡',
    cta_label: 'En profiter →',
    cta_action: 'upsell_addactivities',
    promo_code: 'UPSELL20',
    discount_pct: 20,
    enabled: false,
    order: 0,
    trigger: 'after_confirmation',
  },
  {
    id: 'popup-brasserie',
    title: 'Et pour manger ?',
    body: "Prolongez l'expérience à la Red Planet Brasserie. Réservez une table pour après vos parties.",
    emoji: '🍽️',
    cta_label: 'Réserver une table →',
    cta_action: 'zenchef',
    cta_url: null,
    enabled: true,
    order: 1,
    trigger: 'after_confirmation',
  },
];

function readLS(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key, value) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ==============================================================
// BOOKINGS
// ==============================================================
export async function createBooking(booking) {
  if (isSupabaseConfigured) {
    const { data: customer } = await supabase
      .from('customers')
      .upsert({
        email: booking.customer.email,
        name: booking.customer.name,
        phone: booking.customer.phone,
        company_name: booking.customer.companyName || null,
        vat_number: booking.customer.vatNumber || null,
        address: booking.customer.address || null,
      }, { onConflict: 'email' })
      .select()
      .single();

    const { data: b, error } = await supabase
      .from('bookings')
      .insert({
        reference: booking.id,
        customer_id: customer.id,
        booking_date: booking.date,
        players: booking.players,
        subtotal: booking.subtotal,
        discount: booking.discount,
        total: booking.total,
        paid: booking.paid,
        promo_code: booking.promoCode,
        source: booking.source || 'online',
        package_id: booking.packageId,
      })
      .select()
      .single();
    if (error) throw error;

    const items = booking.items.map((i) => ({
      booking_id: b.id,
      activity_id: i.activityId,
      slot_date: booking.date,
      slot_start: i.start,
      slot_end: i.end,
      players: booking.players,
      unit_price: i.unit,
      total_price: i.total,
    }));
    await supabase.from('booking_items').insert(items);
    return b;
  }

  const all = readLS(LS.bookings, []);
  all.push(booking);
  writeLS(LS.bookings, all);
  return booking;
}

export async function listBookings({ from, to, customerEmail } = {}) {
  if (isSupabaseConfigured) {
    let q = supabase.from('bookings').select('*, booking_items(*), customers(*)').order('created_at', { ascending: false });
    if (from) q = q.gte('booking_date', from);
    if (to) q = q.lte('booking_date', to);
    if (customerEmail) q = q.eq('customers.email', customerEmail);
    const { data } = await q;
    return data || [];
  }
  const real = readLS(LS.bookings, []);
  const fake = readLS(LS.fakeBookings, []);
  let all = [...real, ...fake];
  if (from) all = all.filter((b) => b.date >= from);
  if (to) all = all.filter((b) => b.date <= to);
  if (customerEmail) all = all.filter((b) => b.customer?.email === customerEmail);
  return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function updateBooking(bookingId, updates) {
  if (isSupabaseConfigured) {
    const { data } = await supabase.from('bookings').update(updates).eq('reference', bookingId).select().single();
    return data;
  }
  const all = readLS(LS.bookings, []);
  const idx = all.findIndex((b) => b.id === bookingId);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...updates };
    writeLS(LS.bookings, all);
    return all[idx];
  }
  return null;
}

// ==============================================================
// SLOT OCCUPANCY (temps réel multi-user)
// ==============================================================
export async function getSlotOccupancy(activityId, dateStr) {
  const activity = getActivity(activityId);
  if (!activity) return {};

  if (isSupabaseConfigured) {
    const { data } = await supabase
      .from('slot_occupancy')
      .select('*')
      .eq('activity_id', activityId)
      .eq('slot_date', dateStr);
    const map = {};
    (data || []).forEach((row) => {
      map[row.slot_start.slice(0, 5)] = {
        groups: row.groups_count,
        players: row.players_count,
      };
    });
    return map;
  }

  // fallback : agréger depuis localStorage bookings + fake slots
  const real = readLS(LS.bookings, []).concat(readLS(LS.fakeBookings, []));
  const map = {};
  real.forEach((b) => {
    if (b.date !== dateStr) return;
    b.items?.forEach((i) => {
      if (i.activityId !== activityId) return;
      const key = i.start;
      if (!map[key]) map[key] = { groups: 0, players: 0 };
      map[key].groups += 1;
      map[key].players += b.players;
    });
  });
  // ajout fake occupied (démo visuelle)
  const { full, partial } = getFakeOccupiedSlots(activity, dateStr);
  full.forEach((start) => {
    if (!map[start]) map[start] = { groups: 1, players: activity.maxPlayers };
  });
  Object.entries(partial).forEach(([start, data]) => {
    if (!map[start]) map[start] = data;
  });
  return map;
}

export async function getSlotBlocks(dateStr) {
  if (isSupabaseConfigured) {
    const { data } = await supabase.from('slots').select('*').eq('slot_date', dateStr).eq('blocked', true);
    return data || [];
  }
  const all = readLS(LS.slotBlocks, []);
  return all.filter((b) => b.date === dateStr);
}

export async function blockSlot(block) {
  if (isSupabaseConfigured) {
    const { data } = await supabase.from('slots').insert({
      activity_id: block.activityId,
      slot_date: block.date,
      start_time: block.start,
      end_time: block.end,
      blocked: true,
      block_reason: block.reason,
      note: block.note,
    }).select().single();
    return data;
  }
  const all = readLS(LS.slotBlocks, []);
  const entry = { id: Date.now() + Math.random(), ...block, createdAt: new Date().toISOString() };
  all.push(entry);
  writeLS(LS.slotBlocks, all);
  return entry;
}

export async function unblockSlot(blockId) {
  if (isSupabaseConfigured) {
    return supabase.from('slots').delete().eq('id', blockId);
  }
  const all = readLS(LS.slotBlocks, []);
  writeLS(LS.slotBlocks, all.filter((b) => b.id !== blockId));
}

// ==============================================================
// SLOT NOTES
// ==============================================================
export async function getSlotNotes(dateStr) {
  if (isSupabaseConfigured) {
    const { data } = await supabase
      .from('slots')
      .select('*')
      .eq('slot_date', dateStr)
      .not('note', 'is', null);
    return data || [];
  }
  return readLS(LS.slotNotes, []).filter((n) => n.date === dateStr);
}

export async function setSlotNote(note) {
  const all = readLS(LS.slotNotes, []);
  const filtered = all.filter(
    (n) => !(n.date === note.date && n.activityId === note.activityId && n.start === note.start)
  );
  filtered.push({ ...note, updatedAt: new Date().toISOString() });
  writeLS(LS.slotNotes, filtered);
  return note;
}

// ==============================================================
// AUDIT LOG
// ==============================================================
export async function logAudit(entry) {
  const staff = readLS(LS.activeStaff, null);
  const full = {
    id: Date.now() + Math.random(),
    staffUserName: staff?.name || 'anonymous',
    staffUserId: staff?.id || null,
    createdAt: new Date().toISOString(),
    ...entry,
  };
  if (isSupabaseConfigured) {
    await supabase.from('audit_log').insert({
      staff_user_id: full.staffUserId,
      staff_user_name: full.staffUserName,
      action: full.action,
      entity_type: full.entityType,
      entity_id: full.entityId,
      before_data: full.before,
      after_data: full.after,
      notes: full.notes,
    });
    return full;
  }
  const all = readLS(LS.auditLog, []);
  all.push(full);
  if (all.length > 500) all.splice(0, all.length - 500);
  writeLS(LS.auditLog, all);
  return full;
}

export async function listAuditLog(limit = 50) {
  if (isSupabaseConfigured) {
    const { data } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return data || [];
  }
  return readLS(LS.auditLog, []).slice().reverse().slice(0, limit);
}

// ==============================================================
// STAFF USERS & SESSIONS
// ==============================================================
const DEFAULT_STAFF = [
  { id: 'staff-1', email: 'admin@multiwex.be', name: 'Admin Demo', permissions: { all: true }, active: true },
  { id: 'staff-2', email: 'accueil@multiwex.be', name: 'Accueil', permissions: { calendar: true, bookings_view: true, bookings_edit: true, on_site_booking: true }, active: true },
  { id: 'staff-3', email: 'manager@multiwex.be', name: 'Manager', permissions: { calendar: true, bookings_view: true, bookings_edit: true, on_site_booking: true, financial_reports: true, settings: true }, active: true },
];

export function listStaffUsers() {
  const stored = readLS(LS.staffUsers, null);
  if (!stored) {
    writeLS(LS.staffUsers, DEFAULT_STAFF);
    return DEFAULT_STAFF;
  }
  return stored;
}

export function saveStaffUsers(users) {
  writeLS(LS.staffUsers, users);
}

export function getActiveStaff() {
  return readLS(LS.activeStaff, null);
}

export function setActiveStaff(user) {
  if (user) writeLS(LS.activeStaff, user);
  else {
    if (typeof window !== 'undefined') localStorage.removeItem(LS.activeStaff);
  }
}

// ==============================================================
// CONFIG (content editor)
// ==============================================================
export function getConfig(key) {
  const stored = readLS(LS.config, {});
  return stored[key] ?? defaultConfig[key];
}

export function setConfig(key, value) {
  const stored = readLS(LS.config, {});
  stored[key] = value;
  writeLS(LS.config, stored);
}

export function getAllConfig() {
  const stored = readLS(LS.config, {});
  return { ...defaultConfig, ...stored };
}

// ==============================================================
// POPUPS (after-confirmation, upsell, etc.)
// ==============================================================
export function getPopups() {
  const stored = readLS(LS.popups, null);
  if (!stored) {
    writeLS(LS.popups, defaultPopups);
    return defaultPopups;
  }
  return stored;
}

export function savePopups(popups) {
  writeLS(LS.popups, popups);
}

export function upsertPopup(popup) {
  const all = getPopups();
  const idx = all.findIndex((p) => p.id === popup.id);
  if (idx >= 0) all[idx] = { ...all[idx], ...popup };
  else all.push({ ...popup, id: popup.id || 'popup-' + Date.now() });
  savePopups(all);
  return all;
}

export function deletePopup(id) {
  const all = getPopups().filter((p) => p.id !== id);
  savePopups(all);
  return all;
}

// ==============================================================
// REALTIME SUBSCRIPTIONS
// ==============================================================
export function subscribeBookings(onChange) {
  if (isSupabaseConfigured) {
    const channel = supabase
      .channel('bookings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_items' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slots' }, onChange)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }
  // fallback : écouter les storage events (fonctionne entre onglets même origin)
  const handler = (e) => {
    if ([LS.bookings, LS.slotBlocks].includes(e.key)) onChange();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }
  return () => {};
}
