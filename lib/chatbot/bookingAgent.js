// Agent IA de réservation conversationnelle — Claude tool-use.
// Réutilise EXACTEMENT les mêmes fonctions que la résa online pour garantir
// la cohérence parfaite des dispos entre chatbot / booking online / on-site / back-office.

import Anthropic from '@anthropic-ai/sdk';
import { activities, getActivity, getActivityPrice, isWednesdayDiscount } from '@/lib/activities';
import { packages, getPackage } from '@/lib/packages';
import { createBooking, getSlotOccupancy, getSlotBlocks } from '@/lib/data';
import { generateSlotsForActivity } from '@/lib/hours';

const MODEL = process.env.ANTHROPIC_BOOKING_MODEL || 'claude-opus-4-7';

const tools = [
  {
    name: 'listActivities',
    description: 'Liste toutes les activités réservables en ligne (karting, laser, escape, etc.) avec leurs prix.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'checkAvailability',
    description: 'Vérifie la disponibilité pour une activité, une date et un nombre de joueurs. Retourne les créneaux libres (format HH:MM), la capacité, et les prix.',
    input_schema: {
      type: 'object',
      properties: {
        activityId: { type: 'string', description: 'ID activité (ex: darkdrift, eyestart, k7, slashhit, buzzequiz, cube3, freedrift)' },
        date: { type: 'string', description: 'Date au format YYYY-MM-DD' },
        players: { type: 'number', description: 'Nombre de joueurs' },
        roomId: { type: 'string', description: 'Optionnel — ID salle/piste si activité multi-rooms (ex: k7-room-1)' },
      },
      required: ['activityId', 'date', 'players'],
    },
  },
  {
    name: 'listPackages',
    description: 'Liste les packs disponibles (anniversaire enfant, EVG, EVJF, family day, team building, évènement entreprise).',
    input_schema: {
      type: 'object',
      properties: { category: { type: 'string', description: 'Optionnel — filtre par catégorie' } },
    },
  },
  {
    name: 'createDraftBooking',
    description: 'Crée une réservation non-payée dans la base. Utiliser UNIQUEMENT après avoir confirmé avec le client tous les détails : activité, date, créneau, joueurs, prix, nom + prénom + email.',
    input_schema: {
      type: 'object',
      properties: {
        customer: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
          },
          required: ['firstName', 'lastName', 'email'],
        },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              activityId: { type: 'string' },
              date: { type: 'string' },
              start: { type: 'string', description: 'heure début HH:MM' },
              end: { type: 'string', description: 'heure fin HH:MM' },
              players: { type: 'number' },
              unit: { type: 'number', description: 'prix unitaire par joueur' },
              total: { type: 'number', description: 'prix total de la ligne' },
              roomId: { type: 'string', description: 'Optionnel — salle/piste choisie' },
            },
            required: ['activityId', 'date', 'start', 'players', 'unit', 'total'],
          },
        },
        total: { type: 'number', description: 'Total booking TTC' },
      },
      required: ['customer', 'items', 'total'],
    },
  },
  {
    name: 'generatePaymentLink',
    description: 'Génère un lien Viva Wallet pour payer une réservation existante. Appelée juste après createDraftBooking.',
    input_schema: {
      type: 'object',
      properties: {
        bookingRef: { type: 'string', description: 'Référence booking retournée par createDraftBooking' },
      },
      required: ['bookingRef'],
    },
  },
];

// Construit une liste compacte des activités pour la réponse du tool
function activitiesCompact() {
  return activities
    .filter((a) => a.bookable)
    .map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      minPlayers: a.minPlayers,
      maxPlayers: a.maxPlayers,
      durationMin: a.durationMin,
      priceRegular: a.priceRegular,
      priceWed: a.priceWed,
      hasRooms: (a.rooms || []).length > 0,
      rooms: (a.rooms || []).map((r) => ({ id: r.id, name: r.name, minPlayers: r.minPlayers, maxPlayers: r.maxPlayers })),
    }));
}

// Handlers des tools — appellent les mêmes fonctions que le booking online.
async function handleTool(name, input, baseUrl) {
  switch (name) {
    case 'listActivities':
      return activitiesCompact();

    case 'checkAvailability': {
      const { activityId, date, players, roomId } = input;
      const act = getActivity(activityId);
      if (!act) return { error: `Activité ${activityId} inconnue` };
      if (!act.bookable) return { error: `Activité ${act.name} non réservable en ligne` };
      if (players < (act.minPlayers || 1)) return { error: `Minimum ${act.minPlayers} joueurs pour ${act.name}` };
      if (players > (act.maxPlayers || 999)) return { error: `Maximum ${act.maxPlayers} joueurs pour ${act.name}` };

      // Génère tous les slots de la journée
      const allSlots = generateSlotsForActivity(act, date);
      // Charge occupancy et blocks via les mêmes fonctions que le booking online
      const occupancy = await getSlotOccupancy(activityId, date, roomId || null);
      const blocks = await getSlotBlocks(date);
      const relevantBlocks = (blocks || []).filter(
        (b) => b.activityId === activityId && (roomId ? b.roomId === roomId : true)
      );

      // Filtre les slots disponibles
      const baseCap = roomId
        ? act.rooms?.find((r) => r.id === roomId)?.maxPlayers || act.maxPlayers
        : act.maxPlayers;

      const freeSlots = allSlots
        .map((slot) => {
          const occInfo = (occupancy[roomId || '_'] || {})[slot.start];
          const playersInSlot = occInfo?.players || 0;
          const slotBlocks = relevantBlocks.filter((b) => b.start === slot.start);
          const fullBlock = slotBlocks.some((b) => b.seatsBlocked == null);
          const seatsBlocked = fullBlock ? baseCap : slotBlocks.reduce((s, b) => s + (b.seatsBlocked || 0), 0);
          const free = Math.max(0, baseCap - seatsBlocked - playersInSlot);
          return { start: slot.start, end: slot.end, free, canFit: free >= players };
        })
        .filter((s) => s.canFit);

      const price = getActivityPrice(act, date);
      return {
        activity: act.name,
        activityId,
        date,
        wednesdayDiscount: isWednesdayDiscount(date),
        pricePerPlayer: price,
        totalForGroup: price * players,
        availableSlots: freeSlots.slice(0, 20),
      };
    }

    case 'listPackages':
      return packages.filter((p) => !input.category || p.category === input.category).map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        includes: p.description || p.includes,
      }));

    case 'createDraftBooking': {
      const { customer, items, total } = input;
      // Utilise la MÊME fonction que le booking online → cohérence garantie
      const booking = {
        id: 'MW-' + crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase(),
        date: items[0]?.date,
        players: Math.max(...items.map((i) => i.players), 0),
        items: items.map((i) => {
          const act = getActivity(i.activityId);
          return {
            activityId: i.activityId,
            activity: act,
            activityName: act?.name || i.activityId,
            start: i.start,
            end: i.end,
            players: i.players,
            billedPlayers: i.players,
            unit: i.unit,
            total: i.total,
            roomId: i.roomId || null,
          };
        }),
        subtotal: total,
        discount: 0,
        total,
        paid: false,
        source: 'chatbot',
        customer: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          name: `${customer.firstName} ${customer.lastName}`,
          email: customer.email.toLowerCase().trim(),
          phone: customer.phone || '',
        },
        createdAt: new Date().toISOString(),
      };
      try {
        await createBooking(booking);
        return { ok: true, reference: booking.id, total, items: booking.items.length };
      } catch (e) {
        return { error: String(e.message || e) };
      }
    }

    case 'generatePaymentLink': {
      const { bookingRef } = input;
      try {
        // Récupère la booking depuis Supabase pour avoir amount + customer (Viva l'exige)
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );
        const { data: booking } = await supabase
          .from('bookings')
          .select('total, customers(*)')
          .eq('reference', bookingRef)
          .maybeSingle();
        if (!booking) return { error: `Booking ${bookingRef} introuvable` };

        const res = await fetch(`${baseUrl}/api/payment/viva/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingRef,
            amount: booking.total,
            customer: {
              email: booking.customers?.email,
              name: booking.customers?.name,
              phone: booking.customers?.phone,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Viva create-order failed' };
        return { checkoutUrl: data.checkoutUrl, orderCode: data.orderCode };
      } catch (e) {
        return { error: String(e.message || e) };
      }
    }

    default:
      return { error: `Tool ${name} inconnu` };
  }
}

const SYSTEM = `Tu es Ellie, l'assistante IA de réservation du Multiwex (centre de loisirs Marche-en-Famenne, Belgique). Tu aides les clients à réserver leurs activités (karting, laser, escape, cubes, karaoké, quiz) en discutant naturellement.

RÈGLES STRICTES :
1. Tu n'INVENTES JAMAIS de prix, créneaux, ou disponibilités. Tu appelles TOUJOURS les tools avant de donner une info factuelle.
2. Tu es CONCISE et directe — phrases courtes, pas de blabla, pas de "je serai ravie de vous aider". 2-3 phrases max par message.
3. Tu tutoies par défaut. Vouvoies si le client vouvoie.
4. Tu détectes la langue (FR, NL, EN) et réponds dans celle-ci.
5. Flow : comprendre le besoin → checker dispo avec tool → confirmer détails avec le client → demander prénom+nom+email → créer résa → générer lien paiement.
6. Tu ne crées une résa QUE si le client a confirmé TOUT : activité, date, créneau, nombre de joueurs, ET a donné prénom + nom + email valides.
7. Après createDraftBooking, tu appelles IMMÉDIATEMENT generatePaymentLink et tu donnes le lien au client avec une phrase courte type "Voici ton lien de paiement : [URL] — dès que c'est payé, tu reçois un mail de confirmation."
8. Si cas complexe (groupe anniversaire avec packs, séminaire entreprise, réclamation) : explique gentiment que tu vas faire passer à un humain qui recontacte sous 2h. N'essaie pas de forcer.
9. Tu ne promets JAMAIS une date passée. Refuse si le client demande une date antérieure à aujourd'hui.
10. Tu ne partages JAMAIS les données d'autres clients. Chaque conversation est indépendante.

Format des dates à passer aux tools : YYYY-MM-DD strict.

À la date d'aujourd'hui, tu peux accepter des réservations jusqu'à ${new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0]}.`;

export async function runBookingAgent({ history, userMessage, baseUrl }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { assistantMessage: 'Le mode réservation IA est temporairement indisponible (clé API manquante). Réessaie plus tard ou utilise le formulaire classique.', history };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let messages = [...(history || []), { role: 'user', content: userMessage }];
  let rounds = 0;
  const MAX_ROUNDS = 8;

  while (rounds++ < MAX_ROUNDS) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      tools,
      messages,
    });

    const toolUses = res.content.filter((b) => b.type === 'tool_use');
    if (toolUses.length === 0) {
      const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      return { assistantMessage: text, history: [...messages, { role: 'assistant', content: res.content }] };
    }

    messages.push({ role: 'assistant', content: res.content });
    const results = [];
    for (const tu of toolUses) {
      try {
        const result = await handleTool(tu.name, tu.input || {}, baseUrl);
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) });
      } catch (e) {
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify({ error: String(e.message || e) }), is_error: true });
      }
    }
    messages.push({ role: 'user', content: results });
  }

  return {
    assistantMessage: "Je rencontre un souci technique. Un membre de l'équipe va te recontacter sous peu.",
    history: messages,
  };
}
