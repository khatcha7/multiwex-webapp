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
  notes: 'mw_notes_v2',
  noteCategories: 'mw_note_categories_v2',
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
  'booking.closure_min_online': 30,
  'booking.bypass_package_toggle': false,
  'promo.demo_code': 'DEMO100',
  'contact.phone': '+32 (0)84 770 222',
  'contact.email': 'info@multiwex.be',
  // Display toggles
  'display.calendar_stats_bar': true,
  'display.formula_badges': true,
  'display.checkin_presence': true,
  'display.share_button': true,
  'display.promo_report_bloc': true,
  'display.funnel_analytics': true,
  // Activités désactivées : { activityId: { disabled: true, reason: "..." } }
  'activities.disabled': {},
  'payment.max_giftcards': 3,
  'pdf.company_name': 'MULTIWEX',
  'pdf.footer': 'Multiwex · Rue des Deux Provinces 1, 6900 Marche-en-Famenne · +32 (0)84 770 222',
  'pdf.accent_color': '#e8005a',
  // === Entreprise (utilisé dans factures, mails, footer) ===
  'company.legal_name': 'MULTIWEX SRL',
  'company.bce': 'BE 1009.786.133',
  'company.tva': 'BE 1009.786.133',
  'company.address_street': 'Rue des Deux Provinces 1',
  'company.address_zip': '6900',
  'company.address_city': 'Marche-en-Famenne',
  'company.address_country': 'Belgique',
  'company.iban': 'BE00 0000 0000 0000',
  'company.bic': '',
  'company.website': 'https://www.multiwex.be',
  'company.maps_url': 'https://maps.google.com/?q=Rue+des+Deux+Provinces+1,+6900+Marche-en-Famenne',
  'company.google_reviews_url': 'https://g.page/r/multiwex/review',
  // Réseaux sociaux
  'social.facebook': 'https://www.facebook.com/multiwex',
  'social.instagram': 'https://www.instagram.com/multiwex',
  'social.tiktok': 'https://www.tiktok.com/@multiwex',
  'social.linkedin': 'https://www.linkedin.com/company/multiwex',
  'social.youtube': 'https://www.youtube.com/@multiwex',
  // === Email (Resend) ===
  'email.from': 'reservations@multiwex.be',
  'email.from_name': 'Multiwex',
  'email.reply_to': 'info@multiwex.be',
  'email.bcc_internal': '',
  // Templates email — sujets + intros éditables
  'email.subject_confirmation': '✓ Votre réservation Multiwex est confirmée — {ref}',
  'email.intro_confirmation': "Merci pour votre réservation ! Préparez-vous à explorer de nouveaux mondes au Multiwex. Voici le récapitulatif de votre venue.",
  'email.subject_postvisit': 'Votre avis compte — Multiwex',
  'email.intro_postvisit': "Merci d'être venu vivre l'expérience Multiwex ! On espère que vous avez passé un excellent moment. Votre avis nous aide énormément.",
  'email.postvisit_enabled': true,
  'email.postvisit_delay_hours': 24,
  'email.subject_giftcard': '🎁 Votre carte cadeau Multiwex',
  'email.intro_giftcard': "Voici votre carte cadeau Multiwex prête à être utilisée. Profitez d'une expérience inoubliable !",
  // === Facture ===
  'invoice.tva_rate': 21,
  'invoice.prefix': 'MWX-2026-',
  'invoice.next_number': 1,
  'invoice.cgv_url': 'https://www.multiwex.be/fr/cgv',
  'invoice.footer_legal': 'TVA non comprise dans les prix affichés sauf mention contraire. Conditions générales sur multiwex.be/cgv',
  // === Infos pratiques par activité (affichées dans le mail de confirmation) ===
  'practical.battlekart': "Présentez-vous 15 min avant. Tenue confortable et chaussures fermées obligatoires.",
  'practical.eyestart': "Présentez-vous 10 min avant. Lunettes de vue acceptées sous le casque VR.",
  'practical.darkdrift': "Présentez-vous 15 min avant. Chaussures fermées obligatoires.",
  'practical.k7': "Présentez-vous 10 min avant. Snacks et boissons disponibles à la Red Planet Brasserie.",
  'practical.slash': "Présentez-vous 10 min avant. Chaussures fermées obligatoires pour la sécurité.",
  'practical.freedrift': "Présentez-vous 15 min avant. Chaussures fermées obligatoires.",
  // === Cross-sell / Upsell dans le mail ===
  'crosssell.redplanet_enabled': true,
  'crosssell.redplanet_text': "Envie d'une pause gourmande avant ou après vos activités ? Réservez votre table à la Red Planet Brasserie.",
  'crosssell.redplanet_url': 'https://www.multiwex.be/fr/brasserie',
  'crosssell.activities_enabled': true,
  'crosssell.activities_text': "Et si vous prolongiez l'expérience ? Découvrez nos autres activités et créez votre journée idéale.",
  'crosssell.share_enabled': true,
  // === Mail post-visite — message social proof ===
  'postvisit.review_cta': "Notez votre expérience sur Google",
  'postvisit.outro': "Au plaisir de vous revoir bientôt au Multiwex !",
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

// Normalise une booking renvoyée par Supabase vers le format attendu par l'UI
// (équivalent au format localStorage utilisé partout dans les composants).
function normalizeSupabaseBooking(b) {
  if (!b) return null;
  const customer = Array.isArray(b.customers) ? b.customers[0] : b.customers;
  return {
    id: b.reference || b.id,
    reference: b.reference,
    _supabaseId: b.id,
    date: b.booking_date,
    players: b.players,
    subtotal: b.subtotal,
    discount: b.discount,
    total: b.total,
    paid: b.paid,
    paymentMethod: b.payment_method,
    promoCode: b.promo_code,
    source: b.source,
    packageId: b.package_id,
    staffName: b.staff_name,
    notes: b.notes,
    createdAt: b.created_at,
    customer: customer
      ? {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          companyName: customer.company_name,
          vatNumber: customer.vat_number,
          address: customer.address,
        }
      : null,
    items: (b.booking_items || []).map((it) => {
      const a = getActivity(it.activity_id);
      return {
        id: it.id,
        activityId: it.activity_id,
        activityName: a?.name || it.activity_id,
        slotDate: it.slot_date,
        start: (it.slot_start || '').slice(0, 5),
        end: (it.slot_end || '').slice(0, 5),
        players: it.players,
        unit: it.unit_price,
        total: it.total_price,
        roomId: it.room_id || null,
      };
    }),
  };
}

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
        payment_method: booking.paymentMethod || (booking.promoCode ? 'free' : null),
        staff_name: booking.staffName || null,
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
      // players réels par item (était bookmaximum.players → bug : tous les items partageaient le max)
      players: i.players ?? i.billedPlayers ?? booking.players,
      unit_price: i.unit,
      total_price: i.total,
      room_id: i.roomId || null,
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
    return (data || []).map(normalizeSupabaseBooking);
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
    // Sépare les champs bookings vs items
    const { items, ...bookingFields } = updates;
    // Mappe les clés camelCase → snake_case pour bookings
    const dbFields = {};
    if (bookingFields.players !== undefined) dbFields.players = bookingFields.players;
    if (bookingFields.total !== undefined) dbFields.total = bookingFields.total;
    if (bookingFields.subtotal !== undefined) dbFields.subtotal = bookingFields.subtotal;
    if (bookingFields.discount !== undefined) dbFields.discount = bookingFields.discount;
    if (bookingFields.paid !== undefined) dbFields.paid = bookingFields.paid;
    if (bookingFields.paymentMethod !== undefined) dbFields.payment_method = bookingFields.paymentMethod;
    if (bookingFields.staffName !== undefined) dbFields.staff_name = bookingFields.staffName;
    if (Object.keys(dbFields).length > 0) {
      await supabase.from('bookings').update(dbFields).eq('reference', bookingId);
    }
    // Mets à jour chaque booking_item s'ils ont un id (= viennent de la DB)
    if (Array.isArray(items)) {
      for (const it of items) {
        if (!it.id) continue;
        const itemDb = {};
        if (it.players !== undefined) itemDb.players = it.players;
        if (it.start !== undefined) itemDb.slot_start = it.start;
        if (it.end !== undefined) itemDb.slot_end = it.end;
        if (it.roomId !== undefined) itemDb.room_id = it.roomId;
        if (it.unit !== undefined) itemDb.unit_price = it.unit;
        if (it.total !== undefined) itemDb.total_price = it.total;
        if (Object.keys(itemDb).length > 0) {
          await supabase.from('booking_items').update(itemDb).eq('id', it.id);
        }
      }
    }
    return { id: bookingId };
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
// BOOKING ITEM EDITS (move / split)
// ==============================================================
// itemRef pour Supabase : { id: <uuid> }
// itemRef pour fallback LS : { bookingId, activityId, start }
export async function moveBookingItem(itemRef, newItem) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('booking_items')
      .update({
        activity_id: newItem.activityId,
        slot_date: newItem.slotDate,
        slot_start: newItem.slotStart,
        slot_end: newItem.slotEnd,
        players: newItem.players,
      })
      .eq('id', itemRef.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const all = readLS(LS.bookings, []);
  const fake = readLS(LS.fakeBookings, []);
  const stores = [
    { key: LS.bookings, list: all },
    { key: LS.fakeBookings, list: fake },
  ];
  for (const store of stores) {
    const bIdx = store.list.findIndex((b) => (b.id || b.reference) === itemRef.bookingId);
    if (bIdx < 0) continue;
    const items = store.list[bIdx].items || [];
    const iIdx = items.findIndex((i) => i.activityId === itemRef.activityId && i.start === itemRef.start);
    if (iIdx < 0) continue;
    const orig = items[iIdx];
    const updated = {
      ...orig,
      activityId: newItem.activityId,
      activityName: newItem.activityName ?? orig.activityName,
      start: newItem.slotStart,
      end: newItem.slotEnd,
      players: newItem.players,
      total: (orig.unit || orig.unitPrice || 0) * Math.max(newItem.players, 1),
    };
    items[iIdx] = updated;
    store.list[bIdx].items = items;
    writeLS(store.key, store.list);
    return updated;
  }
  throw new Error('Item not found');
}

export async function splitBookingItem(itemRef, keepPlayers, newSlot) {
  if (isSupabaseConfigured) {
    const { data: orig, error: errRead } = await supabase
      .from('booking_items')
      .select('*')
      .eq('id', itemRef.id)
      .single();
    if (errRead || !orig) throw new Error('Item not found');
    const movedPlayers = orig.players - keepPlayers;
    if (movedPlayers <= 0 || keepPlayers <= 0) throw new Error('Invalid split');
    const { error: errUpdate } = await supabase
      .from('booking_items')
      .update({ players: keepPlayers, total_price: (orig.unit_price || 0) * keepPlayers })
      .eq('id', itemRef.id);
    if (errUpdate) throw errUpdate;
    const { data: created, error: errInsert } = await supabase
      .from('booking_items')
      .insert({
        booking_id: orig.booking_id,
        activity_id: newSlot.activityId,
        slot_date: newSlot.slotDate,
        slot_start: newSlot.slotStart,
        slot_end: newSlot.slotEnd,
        players: movedPlayers,
        unit_price: orig.unit_price,
        total_price: (orig.unit_price || 0) * movedPlayers,
      })
      .select()
      .single();
    if (errInsert) throw errInsert;
    return { original: { ...orig, players: keepPlayers }, created };
  }

  const all = readLS(LS.bookings, []);
  const fake = readLS(LS.fakeBookings, []);
  const stores = [
    { key: LS.bookings, list: all },
    { key: LS.fakeBookings, list: fake },
  ];
  for (const store of stores) {
    const bIdx = store.list.findIndex((b) => (b.id || b.reference) === itemRef.bookingId);
    if (bIdx < 0) continue;
    const items = store.list[bIdx].items || [];
    const iIdx = items.findIndex((i) => i.activityId === itemRef.activityId && i.start === itemRef.start);
    if (iIdx < 0) continue;
    const orig = items[iIdx];
    const movedPlayers = orig.players - keepPlayers;
    if (movedPlayers <= 0 || keepPlayers <= 0) throw new Error('Invalid split');
    const unit = orig.unit || orig.unitPrice || 0;
    const updatedOrig = { ...orig, players: keepPlayers, total: unit * keepPlayers };
    const newAct = getActivity(newSlot.activityId);
    const created = {
      ...orig,
      activityId: newSlot.activityId,
      activityName: newAct?.name ?? orig.activityName,
      start: newSlot.slotStart,
      end: newSlot.slotEnd,
      players: movedPlayers,
      total: unit * movedPlayers,
    };
    items[iIdx] = updatedOrig;
    items.push(created);
    store.list[bIdx].items = items;
    writeLS(store.key, store.list);
    return { original: updatedOrig, created };
  }
  throw new Error('Item not found');
}

// ==============================================================
// SLOT OCCUPANCY (temps réel multi-user)
// ==============================================================
// Si roomId est fourni → ne compte que les réservations sur cette room.
// Sinon → toutes réservations sur l'activité (legacy comportement).
export async function getSlotOccupancy(activityId, dateStr, roomId = null) {
  const activity = getActivity(activityId);
  if (!activity) return {};

  if (isSupabaseConfigured) {
    // Query directe booking_items pour avoir le filtre par room_id (la vue slot_occupancy n'a pas ce filtre)
    let q = supabase
      .from('booking_items')
      .select('slot_start, players, room_id')
      .eq('activity_id', activityId)
      .eq('slot_date', dateStr);
    if (roomId) q = q.eq('room_id', roomId);
    const { data } = await q;
    const map = {};
    (data || []).forEach((row) => {
      const key = (row.slot_start || '').slice(0, 5);
      if (!map[key]) map[key] = { groups: 0, players: 0 };
      map[key].groups += 1;
      map[key].players += (row.players || 0);
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
      if (roomId && i.roomId && i.roomId !== roomId) return;
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

// ==============================================================
// SLOT BLOCKS (rebuild — table slot_blocks)
// ==============================================================
// Un bloc = 1 row dans slot_blocks.
// seats_blocked = null → total ; sinon = N places bloquées.
// batch_id = même valeur pour les blocs fusionnés (créneaux consécutifs même activité).

export async function getSlotBlocks(dateStr) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('slot_blocks')
      .select('*')
      .eq('slot_date', dateStr);
    if (error) { console.error('getSlotBlocks', error); return []; }
    // Normalise pour compat UI existante (camelCase + clés legacy)
    return (data || []).map((b) => ({
      id: b.id,
      activityId: b.activity_id,
      activity_id: b.activity_id,
      roomId: b.room_id,
      date: b.slot_date,
      slot_date: b.slot_date,
      start: (b.start_time || '').slice(0, 5),
      start_time: b.start_time,
      end: (b.end_time || '').slice(0, 5),
      end_time: b.end_time,
      seatsBlocked: b.seats_blocked,
      seats_blocked: b.seats_blocked,
      label: b.label,
      reason: b.reason,
      batchId: b.batch_id,
      batch_id: b.batch_id,
      createdByName: b.created_by_name,
    }));
  }
  return readLS(LS.slotBlocks, []).filter((b) => b.date === dateStr);
}

// Liste des blocs sur une plage (utilisé par le client booking)
export async function getSlotBlocksRange(fromDate, toDate) {
  if (isSupabaseConfigured) {
    const { data } = await supabase
      .from('slot_blocks')
      .select('*')
      .gte('slot_date', fromDate)
      .lte('slot_date', toDate);
    return (data || []).map((b) => ({
      id: b.id,
      activityId: b.activity_id,
      roomId: b.room_id,
      date: b.slot_date,
      start: (b.start_time || '').slice(0, 5),
      end: (b.end_time || '').slice(0, 5),
      seatsBlocked: b.seats_blocked,
      label: b.label,
      batchId: b.batch_id,
    }));
  }
  return readLS(LS.slotBlocks, []).filter((b) => b.date >= fromDate && b.date <= toDate);
}

// block = { activityId, roomId?, date, start, end, seatsBlocked?, label?, reason?, batchId? }
export async function blockSlot(block) {
  const staff = getActiveStaff();
  const payload = {
    activity_id: block.activityId,
    room_id: block.roomId || null,
    slot_date: block.date,
    start_time: block.start,
    end_time: block.end,
    seats_blocked: block.seatsBlocked ?? null,
    label: block.label || null,
    reason: block.reason || null,
    batch_id: block.batchId || null,
    created_by_name: staff?.name || null,
  };
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('slot_blocks').insert(payload).select().single();
    if (error) throw error;
    return data;
  }
  const all = readLS(LS.slotBlocks, []);
  const entry = { id: crypto.randomUUID(), ...block, createdAt: new Date().toISOString() };
  all.push(entry);
  writeLS(LS.slotBlocks, all);
  return entry;
}

export async function updateSlotBlock(id, updates) {
  const payload = {
    ...(updates.label !== undefined && { label: updates.label }),
    ...(updates.reason !== undefined && { reason: updates.reason }),
    ...(updates.seatsBlocked !== undefined && { seats_blocked: updates.seatsBlocked }),
  };
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('slot_blocks').update(payload).eq('id', id);
    if (error) throw error;
    return;
  }
  const all = readLS(LS.slotBlocks, []);
  const idx = all.findIndex((b) => b.id === id);
  if (idx >= 0) { all[idx] = { ...all[idx], ...updates }; writeLS(LS.slotBlocks, all); }
}

export async function updateSlotBlockBatch(batchId, updates) {
  const payload = {
    ...(updates.label !== undefined && { label: updates.label }),
    ...(updates.reason !== undefined && { reason: updates.reason }),
  };
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('slot_blocks').update(payload).eq('batch_id', batchId);
    if (error) throw error;
    return;
  }
  const all = readLS(LS.slotBlocks, []);
  all.forEach((b, i) => { if (b.batchId === batchId) all[i] = { ...b, ...updates }; });
  writeLS(LS.slotBlocks, all);
}

export async function unblockSlot(blockId) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('slot_blocks').delete().eq('id', blockId);
    if (error) throw error;
    return;
  }
  const all = readLS(LS.slotBlocks, []).filter((b) => b.id !== blockId);
  writeLS(LS.slotBlocks, all);
}

export async function unblockBatch(batchId) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('slot_blocks').delete().eq('batch_id', batchId);
    if (error) throw error;
    return;
  }
  const all = readLS(LS.slotBlocks, []).filter((b) => b.batchId !== batchId);
  writeLS(LS.slotBlocks, all);
}

// Helper : map { 'activityId|date|HH:MM' => seatsBlocked|null(total) }
// Utilisé par le client booking pour savoir combien de places sont bloquées sur un slot.
export function indexBlocksBySlot(blocks) {
  const map = {};
  (blocks || []).forEach((b) => {
    const key = `${b.activityId}|${b.date}|${b.start}`;
    // si plusieurs blocks sur même slot, on additionne les seats (null = total → toujours bloqué)
    const cur = map[key];
    if (cur === null || b.seatsBlocked == null) { map[key] = null; return; }
    map[key] = (cur || 0) + (b.seatsBlocked || 0);
  });
  return map;
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
    // Ne push staff_user_id que si c'est un UUID valide (legacy IDs string sinon)
    const isUUID = full.staffUserId && typeof full.staffUserId === 'string' && full.staffUserId.length > 30 && full.staffUserId.includes('-');
    await supabase.from('audit_log').insert({
      staff_user_id: isUUID ? full.staffUserId : null,
      staff_user_name: full.staffUserName,
      action: full.action,
      entity_type: full.entityType,
      entity_id: typeof full.entityId === 'string' ? full.entityId : String(full.entityId ?? ''),
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

// Cache staff users (sync read pattern, async write)
let _staffCache = null;

function normalizeStaffUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    permissions: u.permissions || {},
    active: u.active !== false,
  };
}

export async function initStaffUsers() {
  if (_staffCache) return _staffCache;
  if (isSupabaseConfigured) {
    const { data } = await supabase.from('staff_users').select('*').eq('active', true);
    if (!data || data.length === 0) {
      // Seed defaults au premier appel
      for (const u of DEFAULT_STAFF) {
        await supabase.from('staff_users').insert({
          email: u.email,
          name: u.name,
          permissions: u.permissions,
          active: u.active,
        });
      }
      const { data: seeded } = await supabase.from('staff_users').select('*').eq('active', true);
      _staffCache = (seeded || []).map(normalizeStaffUser);
    } else {
      _staffCache = data.map(normalizeStaffUser);
    }
  } else {
    const stored = readLS(LS.staffUsers, null);
    if (!stored) writeLS(LS.staffUsers, DEFAULT_STAFF);
    _staffCache = stored || DEFAULT_STAFF;
  }
  return _staffCache;
}

export function listStaffUsers() {
  if (_staffCache) return _staffCache;
  initStaffUsers();
  // Fallback synchrone pendant l'hydratation
  const stored = readLS(LS.staffUsers, null);
  return stored || DEFAULT_STAFF;
}

export async function saveStaffUsers(users) {
  _staffCache = users;
  if (isSupabaseConfigured) {
    for (const u of users) {
      const isUUID = u.id && typeof u.id === 'string' && u.id.length > 30 && u.id.includes('-');
      const payload = {
        email: u.email,
        name: u.name,
        permissions: u.permissions || {},
        active: u.active !== false,
      };
      if (isUUID) await supabase.from('staff_users').update(payload).eq('id', u.id);
      else await supabase.from('staff_users').insert(payload);
    }
    return;
  }
  writeLS(LS.staffUsers, users);
}

export function getActiveStaff() {
  // Reste en LS — c'est une session navigateur, pas une donnée à partager
  return readLS(LS.activeStaff, null);
}

export function setActiveStaff(user) {
  if (user) writeLS(LS.activeStaff, user);
  else {
    if (typeof window !== 'undefined') localStorage.removeItem(LS.activeStaff);
  }
}

// ==============================================================
// CONFIG (content editor) — cache mémoire + Supabase
// ==============================================================
// Pattern : getConfig/getAllConfig restent SYNC pour compat call-sites
// existants. Le cache est hydraté au démarrage par initConfig() (à appeler
// dans un Provider racine). En attendant l'hydratation, fallback sur LS+default.
let _configCache = null;
let _configLoading = null;

export async function initConfig() {
  if (_configCache) return _configCache;
  if (_configLoading) return _configLoading;
  _configLoading = (async () => {
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('site_config').select('key, value');
      const map = {};
      (data || []).forEach((row) => { map[row.key] = row.value; });
      _configCache = { ...defaultConfig, ...map };
    } else {
      _configCache = { ...defaultConfig, ...readLS(LS.config, {}) };
    }
    return _configCache;
  })();
  const result = await _configLoading;
  _configLoading = null;
  return result;
}

export function getConfig(key) {
  if (_configCache) return _configCache[key];
  // Cache pas encore prêt : fallback LS+default. Trigger init en arrière-plan.
  initConfig();
  const stored = readLS(LS.config, {});
  return stored[key] ?? defaultConfig[key];
}

export function getAllConfig() {
  if (_configCache) return _configCache;
  initConfig();
  return { ...defaultConfig, ...readLS(LS.config, {}) };
}

export async function setConfig(key, value) {
  if (!_configCache) await initConfig();
  _configCache[key] = value;
  if (isSupabaseConfigured) {
    await supabase
      .from('site_config')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  } else {
    const stored = readLS(LS.config, {});
    stored[key] = value;
    writeLS(LS.config, stored);
  }
}

// ==============================================================
// POPUPS (after-confirmation, upsell, etc.) — async + Supabase
// ==============================================================
function normalizePopup(p) {
  return {
    id: p.id,
    title: p.title,
    body: p.body,
    emoji: p.emoji,
    cta_label: p.cta_label,
    cta_action: p.cta_action || 'dismiss',
    cta_url: p.cta_url || null,
    promo_code: p.promo_code || null,
    discount_pct: p.discount_pct || 0,
    enabled: p.enabled === true || p.enabled === 'true',
    order: p.order_position ?? p.order ?? 0,
    trigger: p.trigger_event || p.trigger || 'after_confirmation',
  };
}

function popupToDB(p) {
  return {
    title: p.title,
    body: p.body,
    emoji: p.emoji || null,
    cta_label: p.cta_label || null,
    cta_action: p.cta_action || 'dismiss',
    cta_url: p.cta_url || null,
    promo_code: p.promo_code || null,
    discount_pct: p.discount_pct || 0,
    order_position: p.order ?? 0,
    trigger_event: p.trigger || 'after_confirmation',
    enabled: !!p.enabled,
    active: !!p.enabled, // legacy column compat
  };
}

export async function getPopups() {
  if (isSupabaseConfigured) {
    const { data } = await supabase.from('popups').select('*').order('order_position');
    if (!data || data.length === 0) {
      // Seed defaults au premier appel
      for (const p of defaultPopups) {
        await supabase.from('popups').insert({ ...popupToDB(p) });
      }
      const { data: seeded } = await supabase.from('popups').select('*').order('order_position');
      return (seeded || []).map(normalizePopup);
    }
    return data.map(normalizePopup);
  }
  const stored = readLS(LS.popups, null);
  if (!stored) {
    writeLS(LS.popups, defaultPopups);
    return defaultPopups;
  }
  return stored;
}

export async function savePopups(popups) {
  if (isSupabaseConfigured) {
    for (let i = 0; i < popups.length; i++) {
      const p = { ...popups[i], order: i };
      if (p.id && typeof p.id === 'string' && p.id.length > 30) {
        // UUID Supabase → update
        await supabase.from('popups').update(popupToDB(p)).eq('id', p.id);
      } else {
        // legacy string ID → insert (le récupère pas ici, juste seed)
        await supabase.from('popups').insert(popupToDB(p));
      }
    }
    return;
  }
  writeLS(LS.popups, popups);
}

export async function upsertPopup(popup) {
  if (isSupabaseConfigured) {
    const isUUID = popup.id && typeof popup.id === 'string' && popup.id.length > 30 && popup.id.includes('-');
    if (isUUID) {
      await supabase.from('popups').update(popupToDB(popup)).eq('id', popup.id);
    } else {
      await supabase.from('popups').insert(popupToDB(popup));
    }
    return await getPopups();
  }
  const all = await getPopups();
  const idx = all.findIndex((p) => p.id === popup.id);
  if (idx >= 0) all[idx] = { ...all[idx], ...popup };
  else all.push({ ...popup, id: popup.id || 'popup-' + Date.now() });
  writeLS(LS.popups, all);
  return all;
}

export async function deletePopup(id) {
  if (isSupabaseConfigured) {
    await supabase.from('popups').delete().eq('id', id);
    return await getPopups();
  }
  const all = (await getPopups()).filter((p) => p.id !== id);
  writeLS(LS.popups, all);
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

// ==============================================================
// NOTES SYSTEM (Phase 1)
// ==============================================================

export const DEFAULT_NOTE_CATEGORIES = [
  { name: 'Team building', color: '#b400ff', position: 0 },
  { name: 'Anniversaire', color: '#e8005a', position: 1 },
  { name: 'Joueur absent', color: '#ff8c00', position: 2 },
  { name: 'Cartes cadeaux', color: '#f3d10b', position: 3 },
  { name: 'Fermeture', color: '#888888', position: 4 },
];

export async function listNoteCategories() {
  if (isSupabaseConfigured) {
    const { data } = await supabase.from('note_categories').select('*').order('position');
    return data || [];
  }
  return readLS(LS.noteCategories, []);
}

export async function createNoteCategory(cat) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('note_categories')
      .insert({ name: cat.name, color: cat.color, position: cat.position ?? 0 })
      .select().single();
    if (error) throw error;
    return data;
  }
  const all = readLS(LS.noteCategories, []);
  const created = { id: crypto.randomUUID(), name: cat.name, color: cat.color, position: cat.position ?? all.length, created_at: new Date().toISOString() };
  all.push(created);
  writeLS(LS.noteCategories, all);
  return created;
}

export async function updateNoteCategory(id, updates) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('note_categories').update(updates).eq('id', id);
    if (error) throw error;
    return;
  }
  const all = readLS(LS.noteCategories, []);
  const idx = all.findIndex((c) => c.id === id);
  if (idx >= 0) { all[idx] = { ...all[idx], ...updates }; writeLS(LS.noteCategories, all); }
}

export async function deleteNoteCategory(id) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('note_categories').delete().eq('id', id);
    if (error) throw error;
    return;
  }
  const all = readLS(LS.noteCategories, []).filter((c) => c.id !== id);
  writeLS(LS.noteCategories, all);
}

export async function ensureDefaultNoteCategories() {
  const existing = await listNoteCategories();
  if (existing.length > 0) return existing;
  for (const cat of DEFAULT_NOTE_CATEGORIES) {
    await createNoteCategory(cat);
  }
  return await listNoteCategories();
}

export async function restoreDefaultNoteCategories() {
  const existing = await listNoteCategories();
  const existingNames = new Set(existing.map((c) => c.name));
  for (const cat of DEFAULT_NOTE_CATEGORIES) {
    if (!existingNames.has(cat.name)) await createNoteCategory(cat);
  }
  return await listNoteCategories();
}

export async function listNotes({ from, to, activityId } = {}) {
  if (isSupabaseConfigured) {
    let q = supabase.from('notes').select('*').order('note_date').order('slot_start');
    if (from) q = q.gte('note_date', from);
    if (to) q = q.lte('note_date', to);
    if (activityId) q = q.eq('activity_id', activityId);
    const { data } = await q;
    return data || [];
  }
  let arr = readLS(LS.notes, []);
  if (from) arr = arr.filter((n) => n.note_date >= from);
  if (to) arr = arr.filter((n) => n.note_date <= to);
  if (activityId) arr = arr.filter((n) => n.activity_id === activityId);
  return arr;
}

export async function createNote(note) {
  const staff = getActiveStaff();
  const payload = {
    category_id: note.categoryId || null,
    note_date: note.date,
    scope: note.scope, // 'day' | 'range' | 'slot'
    activity_id: note.activityId || null,
    room_id: note.roomId || null,
    slot_start: note.slotStart || null,
    slot_end: note.slotEnd || null,
    content: note.content,
    // staff IDs sont localStorage (string, pas uuid) → on n'envoie que le nom
    created_by_name: staff?.name || null,
    updated_by_name: staff?.name || null,
  };
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('notes').insert(payload).select().single();
    if (error) throw error;
    return data;
  }
  const all = readLS(LS.notes, []);
  const created = { id: crypto.randomUUID(), ...payload, locked: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  all.push(created);
  writeLS(LS.notes, all);
  return created;
}

export async function updateNote(id, updates) {
  const staff = getActiveStaff();
  const payload = {
    ...(updates.content !== undefined && { content: updates.content }),
    ...(updates.categoryId !== undefined && { category_id: updates.categoryId || null }),
    ...(updates.scope !== undefined && { scope: updates.scope }),
    ...(updates.activityId !== undefined && { activity_id: updates.activityId || null }),
    ...(updates.roomId !== undefined && { room_id: updates.roomId || null }),
    ...(updates.slotStart !== undefined && { slot_start: updates.slotStart || null }),
    ...(updates.slotEnd !== undefined && { slot_end: updates.slotEnd || null }),
    ...(updates.locked !== undefined && { locked: updates.locked }),
    updated_by_name: staff?.name || null,
    updated_at: new Date().toISOString(),
  };
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('notes').update(payload).eq('id', id);
    if (error) throw error;
    return;
  }
  const all = readLS(LS.notes, []);
  const idx = all.findIndex((n) => n.id === id);
  if (idx >= 0) { all[idx] = { ...all[idx], ...payload }; writeLS(LS.notes, all); }
}

export async function deleteNote(id) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) throw error;
    return;
  }
  const all = readLS(LS.notes, []).filter((n) => n.id !== id);
  writeLS(LS.notes, all);
}

// ==============================================================
// MIGRATION LS → SUPABASE (one-shot, déclenché manuellement par admin)
// ==============================================================
// Copie les données présentes en localStorage vers Supabase pour ne rien
// perdre lors du switch. À appeler une seule fois après config Supabase.
export async function migrateLocalStorageToSupabase() {
  if (!isSupabaseConfigured) {
    return { ok: false, reason: 'Supabase not configured' };
  }
  const report = { config: 0, popups: 0, staff: 0, slot_blocks: 0, notes: 0, errors: [] };

  // 1. site_config
  try {
    const cfg = readLS(LS.config, {});
    for (const [key, value] of Object.entries(cfg)) {
      await supabase.from('site_config').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      report.config++;
    }
  } catch (e) { report.errors.push(`config: ${e.message}`); }

  // 2. popups
  try {
    const popups = readLS(LS.popups, []);
    for (let i = 0; i < popups.length; i++) {
      const p = { ...popups[i], order: i };
      const { data: existing } = await supabase.from('popups').select('id').eq('title', p.title).maybeSingle();
      if (!existing) {
        await supabase.from('popups').insert(popupToDB(p));
        report.popups++;
      }
    }
  } catch (e) { report.errors.push(`popups: ${e.message}`); }

  // 3. staff_users (sans password — admin doit reconfigurer)
  try {
    const staff = readLS(LS.staffUsers, []);
    for (const u of staff) {
      const { data: existing } = await supabase.from('staff_users').select('id').eq('email', u.email).maybeSingle();
      if (!existing) {
        await supabase.from('staff_users').insert({
          email: u.email,
          name: u.name,
          permissions: u.permissions || {},
          active: u.active !== false,
        });
        report.staff++;
      }
    }
  } catch (e) { report.errors.push(`staff: ${e.message}`); }

  // 4. slot_blocks (si encore présents en LS — normalement déjà migrés)
  try {
    const blocks = readLS(LS.slotBlocks, []);
    for (const b of blocks) {
      await supabase.from('slot_blocks').insert({
        activity_id: b.activityId,
        room_id: b.roomId || null,
        slot_date: b.date,
        start_time: b.start,
        end_time: b.end,
        seats_blocked: b.seatsBlocked ?? null,
        label: b.label || null,
        reason: b.reason || null,
        batch_id: b.batchId || null,
      });
      report.slot_blocks++;
    }
  } catch (e) { report.errors.push(`slot_blocks: ${e.message}`); }

  // 5. notes (legacy LS.notes → table notes)
  try {
    const notes = readLS(LS.notes, []);
    for (const n of notes) {
      await supabase.from('notes').insert({
        category_id: n.category_id || null,
        note_date: n.note_date || n.date,
        scope: n.scope || 'day',
        activity_id: n.activity_id || null,
        room_id: n.room_id || null,
        slot_start: n.slot_start || null,
        slot_end: n.slot_end || null,
        content: n.content,
        created_by_name: n.created_by_name || null,
      });
      report.notes++;
    }
  } catch (e) { report.errors.push(`notes: ${e.message}`); }

  // Reset les caches mémoire
  _configCache = null;
  _staffCache = null;
  return { ok: true, report };
}

// Init global appelé par un Provider racine
export async function initDataLayer() {
  await Promise.all([initConfig(), initStaffUsers()]);
}

