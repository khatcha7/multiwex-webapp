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
  {
    name: 'escalateToHuman',
    description: 'Enregistre la demande du client pour qu\'un membre du staff la traite manuellement dans les 2h. À utiliser SEULEMENT quand tu ne peux pas conclure (demande très complexe, pack custom, séminaire entreprise, réclamation). Récupère d\'abord prénom+nom+email+téléphone avant de l\'appeler.',
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
        reason: { type: 'string', description: 'Résumé de la demande du client (2-3 phrases)' },
        priority: { type: 'string', description: 'normal | high', enum: ['normal', 'high'] },
      },
      required: ['customer', 'reason'],
    },
  },
];

// Construit une liste compacte des activités pour la réponse du tool
function activitiesCompact() {
  return activities
    .filter((a) => a.bookable)
    .map((a) => {
      const rooms = a.rooms || [];
      const totalParallelCapacity = rooms.length > 0
        ? rooms.reduce((s, r) => s + (r.maxPlayers || 0), 0)
        : a.maxPlayers;
      return {
        id: a.id,
        name: a.name,
        tagline: a.tagline,
        description: a.description,
        minPlayers: a.minPlayers,
        maxPlayersPerRoom: a.maxPlayers,
        totalParallelCapacity,
        durationMin: a.duration,
        priceRegular: a.priceRegular,
        priceWed: a.priceWed,
        privative: !!a.privative,
        hasMultipleRooms: rooms.length > 1,
        rooms: rooms.map((r) => ({ id: r.id, name: r.name, minPlayers: r.minPlayers, maxPlayers: r.maxPlayers })),
        note: rooms.length > 1
          ? `Cette activité a ${rooms.length} ${a.id === 'slashhit' ? 'pistes' : 'salles'} parallèles. Capacité totale simultanée = ${totalParallelCapacity} joueurs. Si le groupe dépasse ${a.maxPlayers} joueurs, proposer un split sur plusieurs ${a.id === 'slashhit' ? 'pistes' : 'salles'} — tous les joueurs jouent EN MÊME TEMPS sur des ${a.id === 'slashhit' ? 'pistes' : 'salles'} séparées.`
          : undefined,
      };
    });
}

// Handlers des tools — appellent les mêmes fonctions que le booking online.
async function handleTool(name, input, baseUrl) {
  switch (name) {
    case 'listActivities':
      return activitiesCompact();

    case 'checkAvailability': {
      const { activityId, date, players, roomId } = input;
      const act = getActivity(activityId);
      if (!act) return { error: `Activité "${activityId}" inconnue. Utilise listActivities() pour voir les IDs valides.` };
      if (!act.bookable) return { error: `${act.name} non réservable en ligne` };
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: `Date "${date}" invalide. Format attendu : YYYY-MM-DD (ex: 2026-05-02).` };
      if (!players || players < 1) return { error: `Nombre de joueurs invalide (${players})` };
      if (players < (act.minPlayers || 1)) return { error: `Minimum ${act.minPlayers} joueurs pour ${act.name}` };

      const rooms = act.rooms || [];
      const isMultiRoom = rooms.length > 1;
      const maxPerRoom = rooms.length > 0 ? Math.max(...rooms.map((r) => r.maxPlayers)) : act.maxPlayers;
      const totalCapacity = isMultiRoom ? rooms.reduce((s, r) => s + r.maxPlayers, 0) : act.maxPlayers;

      if (players > totalCapacity) {
        return { error: `${act.name} : maximum ${totalCapacity} joueurs${isMultiRoom ? ` sur ${rooms.length} ${act.id === 'slashhit' ? 'pistes' : 'salles'} en parallèle` : ''}. Votre groupe de ${players} dépasse cette capacité.` };
      }

      let allSlots, blocks, price;
      try {
        allSlots = generateSlotsForActivity(act, date);
      } catch (e) {
        console.error('[bookingAgent] generateSlotsForActivity failed', { activityId, date, err: e.message });
        return { error: `Impossible de générer les créneaux pour ${act.name} le ${date} — date invalide ou centre fermé ce jour-là. Propose une autre date.` };
      }
      if (!allSlots || allSlots.length === 0) {
        return { message: `Centre fermé le ${date} ou tous les créneaux passés. Propose une autre date.`, availableSlots: [] };
      }
      try {
        blocks = (await getSlotBlocks(date)) || [];
      } catch (e) {
        console.error('[bookingAgent] getSlotBlocks failed', { date, err: e.message });
        blocks = [];
      }
      try {
        price = getActivityPrice(act, date);
      } catch (e) {
        console.error('[bookingAgent] getActivityPrice failed', { activityId, date, err: e.message });
        price = act.priceRegular;
      }

      // === CAS 1 : activité mono-room (ex: DarkDrift, EyeStart, FreeDrift) ===
      if (!isMultiRoom) {
        const targetRoomId = rooms[0]?.id || null;
        let occupancy = {};
        try {
          occupancy = (await getSlotOccupancy(activityId, date, targetRoomId)) || {};
        } catch (e) {
          console.error('[bookingAgent] getSlotOccupancy mono-room failed', { activityId, date, targetRoomId, err: e.message });
          // On continue avec occupancy vide plutôt qu'escalader
        }
        const baseCap = targetRoomId ? rooms[0].maxPlayers : act.maxPlayers;

        // getSlotOccupancy retourne un map PLAT { "HH:MM": { groups, players } }
        const freeSlots = allSlots.map((slot) => {
          const occInfo = occupancy?.[slot.start];
          const playersInSlot = occInfo?.players || 0;
          const slotBlocks = (blocks || []).filter((b) => b.activityId === activityId && b.start === slot.start && (targetRoomId ? b.roomId === targetRoomId : true));
          const fullBlock = slotBlocks.some((b) => b.seatsBlocked == null);
          const seatsBlocked = fullBlock ? baseCap : slotBlocks.reduce((s, b) => s + (b.seatsBlocked || 0), 0);
          const free = Math.max(0, baseCap - seatsBlocked - playersInSlot);
          // Partial OK : on accepte même si slot partiellement pris, tant que dispo >= demandé (activités non-privatives)
          // Pour privatives : free < baseCap signifie occupé par un autre groupe → inutilisable
          const canFit = act.privative ? (free === baseCap) : (free >= players);
          return { start: slot.start, end: slot.end, free, canFit, roomId: targetRoomId };
        }).filter((s) => s.canFit);

        return {
          activity: act.name,
          activityId,
          date,
          privative: !!act.privative,
          multiRoom: false,
          wednesdayDiscount: isWednesdayDiscount(date),
          pricePerPlayer: price,
          totalForGroup: price * players,
          availableSlots: freeSlots.slice(0, 20),
        };
      }

      // === CAS 2 : activité multi-rooms (Slash and Hit 3 pistes, K7 3 salles) ===
      const occByRoom = {};
      for (const r of rooms) {
        try {
          occByRoom[r.id] = (await getSlotOccupancy(activityId, date, r.id)) || {};
        } catch (e) {
          console.error('[bookingAgent] getSlotOccupancy multi-room failed', { activityId, date, roomId: r.id, err: e.message });
          occByRoom[r.id] = {};
        }
      }

      // occByRoom[roomId] est un map PLAT { "HH:MM": {groups, players} }
      const slotAnalysis = allSlots.map((slot) => {
        const roomAvailability = rooms.map((r) => {
          const occInfo = occByRoom[r.id]?.[slot.start];
          const playersInSlot = occInfo?.players || 0;
          const slotBlocks = (blocks || []).filter((b) => b.activityId === activityId && b.roomId === r.id && b.start === slot.start);
          const fullBlock = slotBlocks.some((b) => b.seatsBlocked == null);
          const seatsBlocked = fullBlock ? r.maxPlayers : slotBlocks.reduce((s, b) => s + (b.seatsBlocked || 0), 0);
          // Privative → room libre seulement si zéro occupation
          const roomFree = act.privative
            ? (playersInSlot === 0 && seatsBlocked === 0)
            : (r.maxPlayers - seatsBlocked - playersInSlot > 0);
          const freeSeats = act.privative ? (roomFree ? r.maxPlayers : 0) : Math.max(0, r.maxPlayers - seatsBlocked - playersInSlot);
          return { roomId: r.id, roomName: r.name, maxPlayers: r.maxPlayers, minPlayers: r.minPlayers, freeSeats, available: roomFree };
        });

        const totalFree = roomAvailability.reduce((s, r) => s + r.freeSeats, 0);
        const availableRooms = roomAvailability.filter((r) => r.available);

        let canFit = false;
        let suggestedSplit = null;
        if (players <= maxPerRoom && availableRooms.some((r) => r.freeSeats >= players)) {
          // Tient dans UNE SEULE salle dispo
          canFit = true;
          suggestedSplit = [{ roomId: availableRooms.find((r) => r.freeSeats >= players).roomId, players }];
        } else if (players <= totalFree) {
          // Besoin de splitter sur plusieurs rooms
          canFit = true;
          suggestedSplit = [];
          let remaining = players;
          const sortedRooms = [...availableRooms].sort((a, b) => b.freeSeats - a.freeSeats);
          for (const r of sortedRooms) {
            if (remaining <= 0) break;
            const allocate = Math.min(remaining, r.freeSeats);
            if (allocate >= (r.minPlayers || 1) || sortedRooms.indexOf(r) === 0) {
              suggestedSplit.push({ roomId: r.roomId, roomName: r.roomName, players: allocate });
              remaining -= allocate;
            }
          }
          if (remaining > 0) { canFit = false; suggestedSplit = null; }
        }

        return {
          start: slot.start,
          end: slot.end,
          totalFreeAcrossRooms: totalFree,
          rooms: roomAvailability,
          canFit,
          suggestedSplit,
          splitAcrossMultipleRooms: suggestedSplit && suggestedSplit.length > 1,
        };
      }).filter((s) => s.canFit);

      return {
        activity: act.name,
        activityId,
        date,
        privative: !!act.privative,
        multiRoom: true,
        roomsInfo: rooms.map((r) => ({ id: r.id, name: r.name, maxPlayers: r.maxPlayers, minPlayers: r.minPlayers })),
        wednesdayDiscount: isWednesdayDiscount(date),
        pricePerPlayer: price,
        totalForGroup: price * players,
        availableSlots: slotAnalysis.slice(0, 15),
        note: `Activité avec ${rooms.length} ${activityId === 'slashhit' ? 'pistes' : 'salles'} en parallèle. Si le groupe (${players}) dépasse la capacité d'une seule ${activityId === 'slashhit' ? 'piste' : 'salle'} (${maxPerRoom}), un split est automatiquement suggéré — tous les joueurs jouent EN MÊME TEMPS sur des ${activityId === 'slashhit' ? 'pistes' : 'salles'} séparées.`,
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

    case 'escalateToHuman': {
      const { customer, reason, priority } = input;
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );
        const { data, error } = await supabase.from('chatbot_escalations').insert({
          customer_first_name: customer.firstName,
          customer_last_name: customer.lastName,
          customer_email: customer.email?.toLowerCase().trim(),
          customer_phone: customer.phone || null,
          reason,
          priority: priority || 'normal',
          status: 'pending',
          created_at: new Date().toISOString(),
        }).select().single();
        if (error) return { error: error.message };
        return { ok: true, escalationId: data.id, message: `Demande enregistrée. Un membre du staff recontactera ${customer.firstName} dans les 2h.` };
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

const SYSTEM = `Tu es Ellie, l'assistante IA de réservation du Multiwex (centre de loisirs indoor à Marche-en-Famenne, Belgique). Tu aides les clients à réserver leurs activités en discutant naturellement.

==== CATALOGUE ACTIVITÉS (noms EXACTS à utiliser, ne jamais les modifier) ====

**DarkDrift** — Drift trike indoor — 1 à 6 joueurs, séances 10 min. Trikes électriques sur circuit indoor. Activité partagée (plusieurs groupes peuvent être sur le circuit ensemble, jusqu'à 6 joueurs simultanés).

**FreeDrift** — Drift trike libre — 1 à 4 joueurs, séances 8 min. Trikes électriques pour amateurs de glisse. Activité partagée.

**EyeStart** — VR Arena 100m² — 1 à 8 joueurs, séances 20 min. Casques VR et arène libre pour duels, zombies, énigmes, puzzles. Activité partagée (jusqu'à 8 simultanés).

**K7 Karaoké** — 3 salles privées — 4 à 18 joueurs, séances 2h. 3 salles séparées : Record (4-12 pax), Studio (4-12 pax), Dancefloor (8-18 pax). Chaque groupe privatise sa salle. Groupe > 18 possible via split sur plusieurs salles en parallèle.

**Slash and Hit** — Lancer de haches digital — 2 à 6 joueurs par piste, séances 60 min. IMPORTANT : 3 PISTES EN PARALLÈLE (Piste 1, Piste 2, Piste 3). Capacité totale simultanée = 18 joueurs. Si le groupe fait plus de 6, tu proposes un split sur plusieurs pistes — tous les joueurs jouent EN MÊME TEMPS, juste sur des pistes différentes. Ne JAMAIS refuser un groupe de 7 à 18 joueurs, toujours proposer un split.

**Buzz-e-Quiz** — Quiz interactif — 4 à 12 joueurs, séances 60 min. Salle privée. Quiz compétitif multi-domaines.

**Cube3** — Pixel floor — 1 à 6 joueurs, séances 15 min. Dalles lumineuses, salle obscure, niveaux pixelisés. Salle privée.

==== RÈGLES CRITIQUES ====
1. Tu n'INVENTES JAMAIS de prix, créneaux, ou disponibilités. Tu appelles TOUJOURS checkAvailability() avant de donner une info factuelle.
2. Pour **Slash and Hit** et **K7 Karaoké** qui ont plusieurs pistes/salles : si le groupe dépasse la capacité d'une seule piste/salle, tu proposes le split multi-pistes proposé par le tool. Exemple pour 9 joueurs Slash and Hit : "9 joueurs répartis sur 3 pistes, 3+3+3 en parallèle" — TU NE BLOQUES PAS.
3. Si un créneau est partiellement occupé par un autre groupe et que l'activité n'est PAS privative (DarkDrift, FreeDrift, EyeStart) : tu proposes quand même le créneau si la capacité restante permet d'accueillir le groupe.
4. **Présentation des créneaux** : quand tu as une liste de slots, NE LES DUMP PAS TOUS. Demande d'abord au client "matin / après-midi / soir ?" puis propose 3-4 options dans la tranche choisie. Exemples : matin = 9h-12h, après-midi = 12h-18h, soir = 18h-23h.
4bis. **Multi-rooms (Slash and Hit, K7)** : quand tu proposes un créneau, tu affiches EXPLICITEMENT le `suggestedSplit` renvoyé par le tool — quelle piste/salle avec combien de joueurs. Exemple : "14:00 → 12 joueurs répartis sur Piste 1 (6) + Piste 2 (6), tout le monde joue en même temps". Si `suggestedSplit` est null pour un slot (pas assez de pistes libres), skippe ce slot.
4ter. **Multi-activités** (ex: EVG = Slash and Hit + DarkDrift pour le même groupe) : tu appelles checkAvailability POUR CHAQUE activité séparément, puis tu proposes un créneau DIFFÉRENT par activité (consécutifs pour enchainer, ou en parallèle si vraiment autre type). Tu présentes de façon structurée :
• Slash and Hit : 14:00-15:00 (12 pax sur 2 pistes)
• DarkDrift : 15:15-15:25 (12 pax en 2 vagues de 6, consécutif)
Ne propose JAMAIS la même heure pour 2 activités différentes qu'un groupe doit faire l'une après l'autre — les gens doivent se déplacer.
5. Tu es CONCISE. Phrases courtes. 2-3 phrases max par message. Jamais de "je serai ravie de".
6. Tu tutoies par défaut. Vouvoies si le client vouvoie.
7. Tu détectes la langue (FR, NL, EN) et réponds dans celle-ci.
8. Flow : comprendre besoin → checkAvailability → demander préférence horaire (matin/AM/soir) → proposer 3-4 créneaux filtrés → confirmer détails → récupérer prénom+nom+email → createDraftBooking → generatePaymentLink → donner lien paiement.
9. Tu ne crées une résa QUE si le client a confirmé l'activité + date + créneau + nombre joueurs + a donné prénom + nom + email valides.
10. Après createDraftBooking, tu appelles IMMÉDIATEMENT generatePaymentLink et tu donnes le lien.
11. **Gestion erreurs tool** : si checkAvailability retourne un message "date invalide" ou "centre fermé" : propose au client une AUTRE date (le lendemain, samedi prochain…) — n'escalade PAS. Tu retentes.
12. **Escalade humain** : RÉSERVÉ aux cas vraiment impossibles à conclure toi-même (anniversaire enfant avec pack custom 30+ pax, séminaire entreprise 100+ pax multi-activités multi-dates, réclamation). PAS pour une simple erreur technique ou une date à changer. Si tu dois escalader : récupère prénom + nom + email + téléphone puis appelle escalateToHuman().
13. Tu ne promets JAMAIS une date passée. Refuse si le client demande une date antérieure à aujourd'hui.
14. Tu ne partages JAMAIS les données d'autres clients.

Format dates pour tools : YYYY-MM-DD strict.

Pour un split multi-rooms (Slash and Hit, K7), createDraftBooking accepte plusieurs items : un item par room avec le bon nombre de joueurs par room.

À la date d'aujourd'hui (${new Date().toISOString().split('T')[0]}), tu peux accepter des réservations jusqu'à ${new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0]}.`;

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
        console.error('[bookingAgent] tool error', tu.name, tu.input, e);
        results.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify({ error: `Tool ${tu.name} a échoué: ${String(e.message || e)}. Réessaie avec des paramètres différents OU escalade humain si 2 échecs consécutifs.` }),
          is_error: true,
        });
      }
    }
    messages.push({ role: 'user', content: results });
  }

  return {
    assistantMessage: "Je rencontre un souci technique. Un membre de l'équipe va te recontacter sous peu.",
    history: messages,
  };
}
