# Audit complet pré-production — Multiwex Webapp

> Audit fait directement par le dev qui a écrit le code (pas un sous-agent).
> Couvre : bugs réels, code mort/doublons, suggestions features, suggestions UX, suggestions backend, plan chatbot v2.

---

## A. BUGS / RISQUES — Confirmés par lecture directe

### 🔴 CRITIQUE (bloque la prod)

**A1. `/api/invoice?ref=X` et `/api/booking-ics?ref=X` sans aucune authentification**
- Fichier : `app/api/invoice/route.js`, `app/api/booking-ics/route.js`
- Risque : un attaquant énumère les références (format simple `MW-XXXXXX`) → peut télécharger toutes les factures clients (RGPD nightmare)
- Fix : signed token dans l'URL (générer un HMAC `SHA256(ref + secret)` côté serveur, l'inclure dans le lien du mail, vérifier au download). 30 min de dev.

**A2. `/api/send-postvisit` sans auth réelle**
- Fichier : `app/api/send-postvisit/route.js`
- Le code vérifie `process.env.CRON_SECRET` mais si la var n'est pas set en prod, **tout le monde peut hit l'endpoint** et déclencher l'envoi de mails (= spam).
- Fix : forcer `CRON_SECRET` requis (return 401 si la var n'existe pas). Documenter dans HANDBOOK.

**A3. `/api/send-giftcard` accepte n'importe quel payload**
- Fichier : `app/api/send-giftcard/route.js`
- N'importe qui peut POST `{ amount: 9999, code: "FREE", paid: true, toEmail: "moi@..." }` → mail giftcard frauduleux envoyé.
- Fix : vérifier que la giftcard existe vraiment en DB (lookup par code) AVANT d'envoyer le mail. La route ne doit jamais faire confiance au payload.

**A4. Booking ID généré côté client avec `Math.random()`**
- Fichier : `components/booking/StepRecap.js` (génération MW-XXXXXX)
- 6 chars alphanum = ~2 milliards d'IDs possibles, mais avec biais Math.random → collision possible si 2 sessions concurrentes la même milliseconde.
- Fix : utiliser `crypto.randomUUID().slice(0,8).toUpperCase()` côté client OU mieux, générer côté serveur dans `createBooking` et renvoyer la ref.

### 🟠 IMPORTANT (à fixer avant prod ou risque réel mais contournable)

**A5. Mail confirmation = fire-and-forget**
- `StepRecap.js:151` et `on-site/page.js`
- `fetch('/api/send-confirmation', ...)` sans `await` ni gestion erreur
- Risque : si Resend tombe, la résa est créée mais le client ne reçoit rien. Aucun retry, aucune trace.
- Fix : await + retry + flag `confirmation_sent_at` en DB + bouton manuel "Renvoyer le mail" dans le back-office bookings.

**A6. Pas de validation de date booking côté serveur**
- `lib/data.js:createBooking` accepte n'importe quelle date (passée, +10 ans, etc.)
- Risque : POST malveillant pour fausser les stats, ou bug client qui envoie une date invalide
- Fix : refuser si `booking.date < today - 1jour` (sauf source `on_site` pour les corrections staff).

**A7. Email client jamais normalisé en lowercase**
- `lib/data.js:createBooking` : `email: booking.customer.email`
- `John@X.com` et `john@x.com` créent 2 customers différents → historique fragmenté, mail de connexion compte cassé
- Fix : `.toLowerCase().trim()` à l'écriture ET à la lecture.

**A8. Race condition redeem giftcard**
- `lib/data.js:redeemGiftcard` : lit balance, calcule, écrit → 2 requêtes simultanées peuvent passer la même giftcard 2 fois
- Probabilité réelle faible (pas de scénario "spam click" sur giftcard) mais possible
- Fix : RPC Postgres atomique avec `UPDATE ... RETURNING` + check balance dans la query.

**A9. Double-click possible sur "Confirmer la réservation"**
- `StepRecap.js` : `setSending(true)` est appelé après `await createBooking()` au lieu d'avant
- Fix : `setSending(true)` en première ligne du handler.

**A10. CRON `vercel.json` ne passe pas de header Authorization**
- Le cron Vercel hit `/api/send-postvisit` mais sans `Authorization: Bearer ${CRON_SECRET}`. Donc soit on enlève la check soit on configure le cron pour passer le secret.
- Fix : doc Vercel cron supporte `headers` config dans `vercel.json` :
  ```json
  { "crons": [{ "path": "/api/send-postvisit", "schedule": "0 10 * * *" }] }
  ```
  Le secret CRON_SECRET de Vercel est auto-injecté dans `Authorization: Bearer ...` quand on l'utilise depuis Vercel Cron. À vérifier que c'est bien le cas en prod.

**A11. XSS potentiel dans l'affichage des notes**
- `app/staff/calendar/page.js` : `dangerouslySetInnerHTML` sur le contenu HTML Tiptap des notes
- Tiptap échappe normalement, mais si un staff malicieux insère `<script>` via API directe (pas via l'éditeur), ça s'exécute pour tous les autres staff
- Fix : sanitize avec DOMPurify côté client avant render.

**A12. Settings `email.postvisit_enabled` stocké comme `true`/`'true'` mixés**
- Le config peut être stocké en boolean (depuis le defaultConfig) ou en string (depuis Supabase JSONB → renvoyé comme JS value mais selon le sérialiseur)
- Tu as déjà eu ce bug, je l'ai patché en prod mais le pattern peut casser ailleurs (`display.*`, `crosssell.*_enabled`)
- Fix : helper `getBool(key)` centralisé qui parse correctement.

### 🟢 NICE-TO-HAVE

**A13. `/api/odoo-stub` existe mais ne fait rien**
- Vestige d'une intégration prévue, jamais implémentée. À supprimer ou implémenter.

**A14. Setup défaut `DEFAULT_STAFF` avec emails fictifs (`admin@multiwex.be`)**
- Si client ne change pas, ces logins existent en prod. Les supprimer ou ajouter password obligatoire au premier login.

**A15. `lib/fakeBookings.js` chargé même en prod**
- Génère des résas factices visibles dans le calendrier — utile en démo mais pollue stats prod
- Fix : feature flag `display.fake_bookings` ou env var.

**A16. Console.error en plein milieu de fonctions critiques**
- `[send-confirmation] PDF generation failed` etc. — utile en dev mais devrait aller dans Sentry/Logflare en prod (les logs Vercel sont retentionnés 1h sur free tier)

---

## B. CODE MORT / DOUBLONS / À NETTOYER

**B1. `setSlotNote` / `LS.slotNotes` — legacy obsolète**
- Remplacé par le nouveau système `notes` (table Supabase). Le code legacy reste exporté.
- Action : supprimer + clé `LS.slotNotes` du fichier.

**B2. Duplication des couleurs Multiwex**
- Définies à 4 endroits : `tailwind.config.js`, `app/globals.css`, `lib/pdf/InvoicePDF.jsx`, `lib/email/confirmationTemplate.js`
- Si on change le rose, faut modifier 4 fichiers
- Action : créer `lib/brand.js` exporté partout (couleurs, font, logo path).

**B3. Templates email partiellement dupliqués**
- `confirmationTemplate.js` et `giftcardTemplate.js` ont chacun leur "shell" (header + footer). Devrait partager une seule fonction `commonShell()`.
- Action : extraire dans `lib/email/shell.js`.

**B4. `defaultConfig`, `defaultPopups`, `DEFAULT_STAFF`, `DEFAULT_NOTE_CATEGORIES` tous dans `lib/data.js`**
- Le fichier fait 1100+ lignes. Les seeds devraient être dans `lib/seeds.js` séparé.

**B5. Logique de prix éparpillée**
- `getActivityPrice()` dans `lib/activities.js`, calcul TVA dans 3 endroits, calcul wednesday discount dans 2 endroits.
- Action : centraliser dans `lib/pricing.js`.

**B6. `StepRecap.js` fait 600+ lignes**
- Customer form + payment + cart summary + giftcard + promo + create booking. Trop de responsabilités.
- Action : split en sous-composants (CustomerForm, PaymentBox, GiftcardSelector).

**B7. `app/staff/calendar/page.js` fait 1100+ lignes**
- Tout le calendrier dans un seul fichier. Difficile à maintenir.
- Action : extraire DayViewV2, BlockDialog, Hover tooltip dans `components/staff/calendar/`.

---

## C. SUGGESTIONS FEATURES — Site public

### C1. Vraies fonctionnalités client manquantes

| # | Feature | Pourquoi | Effort |
|---|---|---|---|
| C1.1 | **Self-service annulation/modification** | Réduit charge staff (clients changent eux-mêmes leur date) | 1-2j |
| C1.2 | **Rappel J-1 par mail** | Réduit le no-show de 30-50% | 0.5j (cron existe déjà) |
| C1.3 | **Multi-langues FR/NL/EN** | Belgique = 3 langues officielles, Multiwex à 30km de la frontière allemande/luxembourgeoise | 2-3j (next-intl) |
| C1.4 | **Page actualités/news** | Le site officiel en a une, on devrait synchroniser ou avoir les nôtres | 1j |
| C1.5 | **Galerie photos par activité** | Conversion x2 sur les sites loisirs avec photos vs sans | 0.5j frontend + assets client |
| C1.6 | **Vidéo de chaque activité** | Idem, encore mieux que photos | 0.5j frontend |
| C1.7 | **Section témoignages clients** | Social proof = +20% conversion | 0.5j (manuel) ou 1j (sync Google Reviews) |
| C1.8 | **Compteur de réservations live** | "127 réservations cette semaine" → urgency | 0.3j |
| C1.9 | **Indicateur dispo temps réel sur cards** | "Aujourd'hui : 4 créneaux libres" sur la home | 0.5j |
| C1.10 | **Builder anniversaire enfants** | Forfait packagé = panier moyen +40% | 2j |
| C1.11 | **Builder team building entreprises** | B2B = ticket moyen 5-10x plus haut | 2j |
| C1.12 | **Système de parrainage** | -10€ pour toi + ton ami | 1j |
| C1.13 | **Newsletter avec discount inscription** | Capture lead + mailing futur | 0.5j (Brevo/Mailchimp) |
| C1.14 | **Vérifier solde carte cadeau** | Page publique `/giftcard/check` | 0.3j |
| C1.15 | **Wishlist créneaux** | Sauver pour réserver plus tard | 0.5j |
| C1.16 | **Notification "désistement" sur créneaux pleins** | "Préviens-moi si un créneau se libère" | 1j |
| C1.17 | **Wallet / Top-up** | Client crédite son compte X€, dépense au fur et à mesure | 2j |
| C1.18 | **Programme fidélité (points)** | Engagement + rétention | 2j |
| C1.19 | **Réservation récurrente** | "Tous les samedis pendant 1 mois" → -20% | 1j |
| C1.20 | **PWA installable + push notif** | App mobile sans dev natif | 0.5j (déjà Next.js) |
| C1.21 | **Météo intégrée** | Pluie = booster activités indoor par bandeau auto | 0.3j |
| C1.22 | **Calendrier événements** | Soirées thématiques, concerts, etc. | 1j |
| C1.23 | **Comparateur de tarifs** | Famille (4p) vs amis (8p) → comparaison visuelle | 0.5j |

### C2. Suggestions UX immédiates (quick wins)

- **Loading states partout** : chaque bouton d'action devrait spinner pendant le fetch (actuellement plusieurs boutons sont sans feedback)
- **Toasts de succès/erreur** : Sonner ou react-hot-toast (très peu de feedback actuellement, juste des `alert()`)
- **Confirmations de suppression standardisées** : un composant `<ConfirmDialog />` pour remplacer tous les `if(!confirm(...))` JS natifs
- **Skeleton screens** : remplacer "Chargement…" par des skeletons (sensation de rapidité)
- **Animations transitions** : actuellement zéro animation, ajout de Framer Motion sur 3-4 endroits clés (modale, cards) ferait pro
- **Empty states branded** : si pas de résas → écran custom Multiwex (mascotte astronaute) au lieu de "Aucune réservation"
- **Auto-save formulaires** : si le client commence à remplir et quitte → conserve en LS pour reprise
- **Touch targets mobiles trop petits** : certains boutons font 32px, recommandé 44px minimum

---

## D. SUGGESTIONS BACKEND / ADMIN

### D1. Fonctionnalités back-office manquantes

| # | Feature | Pourquoi | Effort |
|---|---|---|---|
| D1.1 | **Dashboard analytics KPI** | CA/jour, taux occupation, no-show rate, top activités, conversion funnel | 2-3j |
| D1.2 | **Export CSV bookings comptable** | Pour le comptable Multiwex (pas tout le monde a Odoo) | 0.5j |
| D1.3 | **Système remboursement intégré** | Bouton "Rembourser" sur une résa → Stripe refund automatique | 1-2j (besoin Stripe) |
| D1.4 | **Workflow validation manager** | Certaines résas (groupes >20p, B2B) nécessitent validation manager | 1j |
| D1.5 | **Détection patterns suspects** | 5 résas même IP/email en 1h → alerte | 0.5j |
| D1.6 | **Politique cancellation auto** | Si pas de paiement en 15 min → libère le slot | 0.5j (cron) |
| D1.7 | **Gestion abonnements / pass annuel** | Pass illimité / mensuel | 2j |
| D1.8 | **Multi-tenant** | Si Multiwex ouvre un 2e site (pas demain mais à prévoir) | gros (5-10j) |
| D1.9 | **Audit log lisible** | Actuellement audit log existe mais pas d'UI pour le consulter | 0.5j |
| D1.10 | **Permissions fines staff** | Actuellement `permissions.all = true` ou granulaire mal exposé. UI claire pour assigner | 1j |
| D1.11 | **Templates SMS** | Notifications par SMS (J-1 rappel, confirmation) — Twilio | 1-2j |
| D1.12 | **Logs Resend dans back-office** | Voir les mails envoyés/bouncés sans aller sur Resend.com | 0.5j |
| D1.13 | **Bulk actions sur bookings** | Annuler 10 résas d'un coup, exporter, etc. | 0.5j |
| D1.14 | **Gestion des moyens de paiement** | Quels moyens activer/désactiver (Bancontact, Carte, PayPal, etc.) | 1j (besoin intégration paiement) |
| D1.15 | **Editeur de FAQ public** | Page FAQ alimentable depuis back-office | 0.5j |
| D1.16 | **Editeur de page CGV/Privacy** | Idem, pas avoir à toucher au code pour mettre à jour le légal | 0.5j |
| D1.17 | **Bandeau alerte global** | Type "Fermé exceptionnellement le 24/12" affichable sur la home | 0.3j |
| D1.18 | **Settings en mode "preview"** | Voir le rendu mail avant de sauver | 1j |
| D1.19 | **Tests A/B sur prompts/textes** | Mesurer impact d'un changement de wording sur conversion | 2j |

### D2. Sécurité / Robustesse

- **Sentry ou équivalent** : actuellement on a 0 monitoring d'erreurs en prod
- **Uptime monitoring** : UptimeRobot (gratuit) ou Better Uptime
- **Backups Supabase manuels hebdo** : en plus des auto, exporter en local 1× par semaine
- **2FA pour staff** : actuellement juste login/password, pas de 2FA
- **Logs RGPD** : tracker quand un user demande suppression/export pour preuve de conformité
- **Honeypot anti-bot** : champ caché dans formulaires pour détecter bots scrapers

### D3. Performance

- **Pagination `listBookings()`** : actuellement fetch tout l'historique à chaque appel
- **Index Supabase manquants** : sur `bookings.customer_id`, `notes.activity_id`, peut-être `audit_log.entity_id`
- **CDN images** : actuellement images servies depuis Vercel directement, pas optimisées
- **Bundle size** : `@react-pdf/renderer` est lourd côté serveur, c'est ok mais à monitorer
- **Lazy loading** : composants modales chargés au démarrage, pourraient être lazy

---

## E. CHATBOT IA — Plan v2 (avec mode hybride gratuit)

### E1. 3 modes opérationnels (configurable en back-office)

```
Mode 1 — FAQ-ONLY (gratuit, par défaut)
   ↓
   Le bot match la question contre une liste de Q&A préconfigurées
   Si match → réponse instantanée
   Si pas de match → message "Je n'ai pas la réponse, contactez-nous à info@..."
   COÛT : 0€

Mode 2 — HYBRIDE (recommandé prod)
   ↓
   1. Tente FAQ-only d'abord (gratuit + instantané)
   2. Si pas de match → fallback Claude API
   3. La réponse Claude est cachée 24h pour les questions similaires (économie)
   COÛT : ~5-15€/mois pour 1000 conversations

Mode 3 — IA PURE (démo / haut de gamme)
   ↓
   Toutes les questions passent à Claude (avec RAG sur knowledge base)
   Plus naturel, mais coût plus élevé
   COÛT : ~15-50€/mois pour 1000 conversations
```

### E2. Architecture FAQ-only (mode gratuit)

```
Question utilisateur
    ↓
Normalisation (lowercase, sans accents, sans ponctuation)
    ↓
Match contre table chat_faq:
  - Exact match (priorité 1)
  - Keyword match (priorité 2) : si tous les mots-clés de la FAQ sont dans la question
  - Fuzzy match (priorité 3) : Levenshtein distance < 3
    ↓
Si match trouvé → réponse de la FAQ
Si pas de match → message "Je n'ai pas trouvé. Voici 3 sujets fréquents : [boutons cliquables vers FAQ les plus populaires] OU contactez-nous"
```

### E3. Tables Supabase

```sql
-- FAQ : Q&R préconfigurées
create table chat_faq (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  keywords text[] not null,           -- ['horaires', 'ouverture', 'fermé']
  answer text not null,                -- markdown supporté
  category text,                       -- 'horaires' | 'tarifs' | 'activites' | etc.
  enabled boolean default true,
  hits int default 0,                  -- compteur d'utilisations
  created_at timestamptz default now()
);

-- Conversations (mode 2 et 3)
create table chat_conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  visitor_email text,
  visitor_name text,
  created_at timestamptz default now(),
  ended_at timestamptz,
  message_count int default 0,
  used_ai boolean default false,       -- a basculé en Claude au moins 1x
  satisfaction int                     -- 1-5
);

-- Messages
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references chat_conversations(id) on delete cascade,
  role text,                           -- 'user' | 'bot'
  content text,
  source text,                         -- 'faq' | 'ai' | 'fallback'
  faq_id uuid references chat_faq(id), -- si réponse vient d'une FAQ
  ai_cost_usd numeric(8,5),            -- si appel API
  created_at timestamptz default now()
);

-- Knowledge base pour mode 3 (RAG)
create table chat_knowledge (
  id uuid primary key default gen_random_uuid(),
  source text,                         -- 'multiwex.be' | 'instagram' | 'manual'
  title text,
  content text,
  enabled boolean default true,
  embedding vector(1536),
  last_synced_at timestamptz
);

-- Cache réponses AI (économie)
create table chat_ai_cache (
  id uuid primary key default gen_random_uuid(),
  question_hash text unique,           -- SHA256 de la question normalisée
  question text,
  answer text,
  hit_count int default 0,
  created_at timestamptz default now(),
  expires_at timestamptz
);
```

### E4. Settings back-office (onglet "Chatbot IA")

**E4.1 Mode**
- Radio : ☐ FAQ uniquement (gratuit) / ☐ Hybride / ☐ IA pure
- ☐ Activer le chatbot sur le site

**E4.2 Apparence**
- Position bulle : bottom-right / bottom-left
- Couleur principale : color picker
- Avatar : upload
- Nom : input ("Multibot")
- Message d'ouverture : textarea

**E4.3 FAQ (CRUD complet)**
Tableau avec :
- Question
- Mots-clés (tags)
- Réponse (richtext)
- Catégorie
- Hits (analytics)
- Toggle activé
- Boutons : Éditer / Supprimer

Boutons globaux :
- "+ Ajouter FAQ"
- "Importer CSV"
- "Exporter CSV"
- "Restaurer FAQ par défaut" (~30 questions Multiwex pré-écrites)

**E4.4 IA (visible si mode Hybride/IA)**
- Provider : Claude (par défaut) / OpenAI / Mistral
- Modèle : haiku / sonnet
- Clé API : champ password
- Prompt système : richtext
- Max tokens : 500/1000/2000
- Hard cap mensuel : input € (default 30€)
- Cache durée : 1h / 24h / 7j
- Fallback si API down : message custom

**E4.5 Knowledge base (mode IA)**
- Sources auto-sync :
  - ☐ multiwex.be (pages à synchroniser : checkbox liste)
  - ☐ Instagram (token Meta)
  - ☐ Facebook (token Meta)
  - ☐ Google Reviews
  - ☐ Activités (auto depuis lib/activities.js)
- Fréquence : daily / weekly
- Bouton "Synchroniser maintenant"
- Tableau des entrées indexées (avec actions désactiver/supprimer)

**E4.6 Conversations (analytics)**
- Liste des dernières conversations
- Filtre par date / mode utilisé / satisfaction
- Détail d'une conversation : voir tous les messages
- Stats : conversations/jour, % avec FAQ, % avec IA, coût total
- Top questions sans réponse (= gap dans la FAQ → suggérer d'ajouter)

**E4.7 Anti-abus**
- Max messages/session : 50
- Max sessions/IP/heure : 10
- Mots interdits : textarea (un par ligne)
- ☐ Captcha invisible

### E5. Composant front `<ChatWidget />`

```jsx
'use client';
import { useEffect, useState } from 'react';

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [config, setConfig] = useState(null);
  
  useEffect(() => {
    fetch('/api/chat/config').then(r => r.json()).then(setConfig);
  }, []);
  
  if (!config?.enabled) return null;
  
  // Floating bubble + chat panel
  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 100 }}>
      {!open && (
        <button onClick={() => setOpen(true)} 
          style={{ background: config.color, ... }}>
          💬
        </button>
      )}
      {open && <ChatPanel ... />}
    </div>
  );
}
```

À ajouter dans `app/layout.js` (uniquement sur les pages publiques, pas /staff).

### E6. API route `/api/chat`

```
POST /api/chat
Body: { sessionId, message, conversationId? }

Logique :
1. Récupère config (mode actuel)
2. Si mode FAQ-ONLY :
   - Cherche match dans chat_faq
   - Si trouvé → renvoie réponse + faq_id
   - Sinon → renvoie message fallback + suggestions
3. Si mode HYBRIDE :
   - Tente FAQ d'abord
   - Si pas de match → check cache AI
   - Si pas en cache → appel Claude
   - Stocke en cache + en chat_messages
4. Si mode IA :
   - RAG : embedding question → search top-3 chat_knowledge
   - Construit prompt avec contexte
   - Appel Claude (avec hard cap check)
   - Stream réponse via SSE
   - Stocke conversation
```

### E7. Sprints d'implémentation

**Sprint 1 — Mode FAQ-only (1 jour)**
- Migration SQL chat_faq + chat_conversations + chat_messages
- Settings back-office : tab "Chatbot IA" avec config + CRUD FAQ
- Composant `<ChatWidget />` minimal
- API route `/api/chat` avec mode FAQ uniquement
- Seed de 30 FAQ Multiwex par défaut

**Sprint 2 — Mode Hybride (1 jour)**
- Migration chat_ai_cache
- API route étendue avec fallback Claude
- Settings : section IA + clé API + hard cap
- Compteur de coût en back-office

**Sprint 3 — Mode IA pur + RAG (2-3 jours)**
- Migration pgvector + chat_knowledge
- Génération embeddings au create/update
- Recherche sémantique top-k
- Streaming SSE côté front
- Sync multiwex.be (cron)

**Sprint 4 — Polish (1 jour)**
- Conversations dashboard
- Top questions sans réponse
- Multilangue
- Anti-abus

**Total : 5-7 jours dev pour le chatbot complet, 1-2 jours pour le MVP démo client.**

---

## F. PRIORITÉS RECOMMANDÉES

### Phase 0 — Stabilisation pré-prod (1-2j)
- A1, A2, A3 (auth endpoints) — CRITIQUE
- A4 (booking ID serveur) — CRITIQUE
- A5 (mail confirmation await) — CRITIQUE
- A7 (email lowercase)
- A9 (double-click)
- A10 (cron secret)
- A14 (default staff passwords)

### Phase 1 — Quick wins UX (3-5j)
- C2 (loading states + toasts + confirm dialogs)
- C1.2 (rappel J-1)
- C1.4 (page actualités) ou sync depuis multiwex.be
- C1.7 (témoignages)
- C1.9 (dispo temps réel sur cards home)
- C1.20 (PWA installable)
- D1.1 (dashboard analytics) — VITAL pour pitcher

### Phase 2 — Chatbot démo client (1-2j)
- Sprint 1 chatbot (mode FAQ-only)
- 30 FAQ pré-remplies
- Démo prête pour pitch

### Phase 3 — Roadmap business (2-4 semaines)
- C1.10 (anniversaire builder)
- C1.11 (team building builder)
- D1.3 (remboursements)
- C1.3 (multilangue)
- Sprint 2-3 chatbot

---

## G. Ce qui manque dans le projet (méta)

- **Tests** : 0% de coverage. Au minimum : tests E2E Playwright sur le funnel booking
- **Storybook** : utile pour visualiser les composants en isolation
- **Linter strict** : ESLint actuel est laxe, ajouter rules strict + Prettier
- **TypeScript** : tout le projet est en JS, migration progressive en TS = sécurité
- **CI/CD** : actuellement Vercel auto-deploy mais pas de checks (lint, tests) avant merge
- **Versioning sémantique** : pas de tags Git, pas de CHANGELOG.md

---

**TL;DR** :
- 4 critiques bloquants à fix avant prod réelle (auth endpoints + booking ID + mail await)
- 30+ suggestions features pour le site (rappel J-1, builder anniversaire, multilangue, etc.)
- 19 suggestions back-office (analytics, exports, refunds, audit log UI, etc.)
- Plan chatbot complet en 3 modes (gratuit / hybride / pur IA) avec settings back-office complets
- Recommandation : phase 0 (1-2j) → phase 1 (3-5j) → phase 2 chatbot démo (1-2j) avant le pitch client.
