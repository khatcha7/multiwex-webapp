# Plan d'implémentation — Chatbot IA Multiwex

> Bulle de chat temps réel sur le site, alimentée par IA, knowledge base dynamique, config back-office complète.

---

## 1. Vue d'ensemble

**Objectif** : un assistant conversationnel IA disponible 24/7 sur le site public Multiwex pour répondre aux questions clients (tarifs, horaires, activités, comment réserver, etc.) sans intervention humaine.

**Différenciateur** : la knowledge base se met à jour automatiquement depuis les sources officielles Multiwex (site web, réseaux sociaux, FAQ admin) — pas un chatbot statique avec réponses scriptées.

**Pour le client (Multiwex)** : interface back-office pour piloter la connaissance du bot sans dev (prompt, FAQ, sources, ton, etc.).

---

## 2. Architecture proposée

```
┌──────────────────────────────────────────────────────┐
│           SITE PUBLIC (browser visiteur)             │
│   Bulle chat flottante bottom-right                  │
│   Composant React <ChatWidget />                     │
└───────────────────┬──────────────────────────────────┘
                    │ POST /api/chat
                    ▼
┌──────────────────────────────────────────────────────┐
│         API ROUTE /api/chat (Next.js)                │
│   1. Récupère historique conversation                │
│   2. Cherche docs pertinents (RAG)                   │
│   3. Construit prompt système + contexte             │
│   4. Appelle Claude API                              │
│   5. Stream réponse au client                        │
└─┬────────────────────────────────────────────────────┘
  │
  ├──→ Supabase (conversations + KB)
  │       └── Tables : chat_conversations, chat_messages,
  │                    chat_knowledge, chat_embeddings (pgvector)
  │
  ├──→ Claude API (Anthropic)
  │       └── claude-haiku-4-5 (rapide, peu cher) ou
  │           claude-sonnet-4-6 (plus malin)
  │
  └──→ Cron daily : refresh KB
        ├── Scrape multiwex.be (pages activités, news, FAQ)
        ├── Pull derniers posts Instagram/Facebook (Graph API)
        └── Re-génère embeddings vectoriels
```

---

## 3. Stack technique

| Brique | Choix | Justification |
|---|---|---|
| **LLM** | Claude API (Anthropic) | Excellent en français, contexte 200k tokens, prix raisonnable, conformité EU possible |
| **Modèle par défaut** | `claude-haiku-4-5` | $0.80/1M input + $4/1M output → ~0.5 cents par conversation. Latence faible (~1s) |
| **Modèle premium** | `claude-sonnet-4-6` | Pour conversations complexes ou questions multi-étapes |
| **Vector DB** | Supabase pgvector | Déjà dans la stack, extension native Postgres, gratuit |
| **Embeddings** | `text-embedding-3-small` (OpenAI) ou `voyage-3-lite` | ~$0.02/1M tokens, suffisant pour notre volume |
| **Streaming UI** | Server-Sent Events (SSE) ou Vercel AI SDK | UX moderne (texte qui apparaît mot à mot) |
| **Scraping** | Cheerio (HTML parsing) + node-fetch | Simple, suffisant pour multiwex.be |
| **Social API** | Meta Graph API (Instagram/Facebook) | Officiel, requiert app Meta + token |

**Coût estimé** :
- 1000 conversations/mois × 5 messages × 500 tokens = 2.5M tokens
- Avec Haiku : ~$3/mois
- Avec Sonnet : ~$15/mois
- + Embeddings refresh quotidien : ~$1/mois

→ **Coût total : 5-20€/mois** selon volume et modèle.

---

## 4. Schéma DB (migrations à créer)

```sql
-- Conversations (1 par session visiteur)
create table if not exists chat_conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,           -- cookie côté client
  visitor_email text,                  -- si fourni (post-conversation)
  visitor_name text,
  page_url text,                       -- d'où la convo a démarré
  user_agent text,
  created_at timestamptz default now(),
  ended_at timestamptz,
  satisfaction int                     -- rating 1-5 si demandé
);
create index on chat_conversations(session_id);

-- Messages (un par échange)
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references chat_conversations(id) on delete cascade,
  role text not null,                  -- 'user' | 'assistant' | 'system'
  content text not null,
  tokens_in int,
  tokens_out int,
  model text,
  created_at timestamptz default now()
);
create index on chat_messages(conversation_id, created_at);

-- Knowledge base entries (éditables back-office)
create table if not exists chat_knowledge (
  id uuid primary key default gen_random_uuid(),
  source text not null,                -- 'manual' | 'multiwex.be' | 'instagram' | 'facebook'
  source_url text,                     -- URL d'origine si scrapé
  category text,                       -- 'activities' | 'pricing' | 'hours' | 'faq' | 'news' | 'misc'
  title text,
  content text not null,
  enabled boolean default true,
  priority int default 0,              -- pour boost certains contenus
  last_synced_at timestamptz,
  created_at timestamptz default now()
);
create index on chat_knowledge(category, enabled);

-- Embeddings vectoriels (pgvector)
create extension if not exists vector;
alter table chat_knowledge add column if not exists embedding vector(1536);
create index on chat_knowledge using hnsw (embedding vector_cosine_ops);

-- Logs IA (pour debug + optimisation)
create table if not exists chat_ai_logs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references chat_conversations(id),
  prompt jsonb,                        -- messages envoyés à Claude
  response text,
  retrieved_docs jsonb,                -- IDs des chat_knowledge utilisés
  latency_ms int,
  cost_usd numeric(8,5),
  created_at timestamptz default now()
);
```

---

## 5. Settings configurables (back-office)

Nouvel onglet **"Chatbot IA"** dans `/staff/settings` avec :

### 5.1 Configuration générale
- ☐ Activer le chatbot sur le site public
- Position bulle : bottom-right / bottom-left / center
- Couleur principale : color picker (default `#e8005a`)
- Message d'ouverture : textarea (ex: "Bonjour ! Je suis l'assistant Multiwex. Comment puis-je t'aider ?")
- Avatar bot : upload image
- Nom du bot : input (ex: "Multibot", "Astro")
- Heures de disponibilité : 24/7 ou plage horaire (au-delà → message "Disponible de Xh à Yh")

### 5.2 Modèle IA
- Provider : Claude API (par défaut) / OpenAI / Mistral / Gemini
- Modèle : dropdown (haiku / sonnet / opus)
- Temperature : slider 0-1 (default 0.3 = factuel)
- Max tokens réponse : 500 / 1000 / 2000

### 5.3 Prompt système (le plus important !)
Textarea richtext avec :
- Personnalité (ex: "Tu es un assistant amical mais professionnel...")
- Ton (jeune / formel / technique)
- Limites (ex: "Ne donne jamais de prix sans vérifier la KB")
- Comportement si tu ne sais pas (ex: "Propose de contacter par email")
- Variables disponibles : `{visitor_name}`, `{current_date}`, `{current_hour}`

### 5.4 Knowledge base (KB)
Tableau CRUD des entrées :
- Filtres : par source / catégorie / activé/désactivé
- Bouton "+ Ajouter" : titre, catégorie, contenu (markdown), priorité
- Bouton "Importer FAQ" : parse un .csv ou .json
- Bouton "Synchroniser maintenant" : lance le scraping immédiat

### 5.5 Sources auto-sync (cron)
- ☐ multiwex.be (URL configurable)
  - Pages à scraper : checkbox liste (Tarifs, Activités, FAQ, News...)
  - Fréquence : daily / weekly
- ☐ Instagram (@multiwex)
  - Token Meta API (à fournir)
  - Nombre de posts à indexer : 10 derniers
- ☐ Facebook page
- ☐ Google Business Profile (avis clients)
- ☐ Activities catalog (depuis lib/activities.js — auto-included)

### 5.6 Modération & monitoring
- Liste des conversations récentes (lecture)
- Recherche par email / mot-clé
- Score de satisfaction (si demandé en fin de conv)
- Alertes : si bot répond "je ne sais pas" >X fois → indique gap KB
- Export conversations en CSV

### 5.7 Limites anti-abus
- Max messages / session : 50 (default)
- Max sessions / IP / heure : 10
- Mots interdits / regex blacklist
- Captcha si trop de spam

---

## 6. UX / Composant front

### 6.1 Bulle floating (composant `<ChatWidget />`)

```
┌────────────────────────────────────┐
│ Page Multiwex normale...           │
│                                    │
│                                    │
│                                    │
│                                    │
│                          ┌───────┐ │
│                          │  💬   │ │ ← Bouton fermé
│                          └───────┘ │
└────────────────────────────────────┘
```

**Au clic** :

```
┌────────────────────────────────────┐
│ Page Multiwex...                   │
│                    ┌──────────────┐│
│                    │ 🤖 Multibot  ││
│                    │ ─────────────││
│                    │ Bonjour ! Je ││
│                    │ suis là pour ││
│                    │ vous aider...││
│                    │              ││
│                    │ [tu écris...]││
│                    │              ││
│                    │ [Envoyer →]  ││
│                    └──────────────┘│
└────────────────────────────────────┘
```

### 6.2 Features UX clés
- **Streaming** : texte qui apparaît mot à mot (effet "live")
- **Suggestions** : 3 questions cliquables au démarrage (ex: "Quels sont vos horaires ?", "Comment réserver ?", "Activités possibles avec enfants ?")
- **Quick actions** : bouton "Réserver maintenant" pop si l'utilisateur exprime intention de booking
- **Capture lead** : si convo intéressante, bot demande email pour suivi
- **Mobile-first** : plein écran sur mobile, modale sur desktop
- **Persistance** : si user recharge la page, conversation conservée (sessionStorage)
- **Multilangue** : FR/NL/EN (Multiwex est en Belgique)

---

## 7. Sécurité & coût control

### 7.1 Anti-abus
- Rate limiting (Vercel KV ou Upstash) : 10 messages/minute/IP
- Détection prompts injection : regex sur jailbreaks connus
- Coupure auto si conv > 50 messages
- Captcha invisible (hCaptcha) après 3 conversations même IP

### 7.2 Coûts
- Hard cap mensuel : si dépasse 50€ → désactivation auto + alerte admin
- Affichage coût par conversation dans le back-office
- Optimisation : truncate historique au-delà de 10 messages (garder résumé)

### 7.3 RGPD
- Bandeau cookies si tracking
- Conversations anonymisées par défaut (pas d'IP/email sauf opt-in)
- Droit à l'oubli : bouton "supprimer ma conversation"
- Mention dans CGU

---

## 8. Plan d'implémentation par sprints

### Sprint 1 — MVP (1-2 jours)
- [ ] Migration SQL pour les 4 tables
- [ ] Page settings : onglet "Chatbot IA" avec config minimale
- [ ] Composant `<ChatWidget />` simple (pas de streaming)
- [ ] API route `/api/chat` avec Claude API
- [ ] Knowledge base statique : activités + horaires + FAQ depuis lib/activities.js
- [ ] Test end-to-end

### Sprint 2 — RAG + Sources (2-3 jours)
- [ ] Activer pgvector dans Supabase
- [ ] Génération embeddings au create/update knowledge
- [ ] Recherche sémantique top-k avant chaque appel Claude
- [ ] Scraper multiwex.be (cron quotidien)
- [ ] Section back-office pour gérer la KB (CRUD)

### Sprint 3 — UX premium (2 jours)
- [ ] Streaming avec Vercel AI SDK
- [ ] Suggestions au démarrage (configurables)
- [ ] Quick actions (boutons "Réserver", "Voir les tarifs")
- [ ] Multilangue FR/NL/EN
- [ ] Mobile responsive

### Sprint 4 — Sources sociales (2-3 jours)
- [ ] Intégration Instagram Graph API
- [ ] Intégration Facebook Page API
- [ ] Cron de refresh + dedup
- [ ] Logs + monitoring back-office

### Sprint 5 — Polish & prod (1-2 jours)
- [ ] Rate limiting + anti-abus
- [ ] Hard cap coût
- [ ] RGPD : bandeau, opt-out, droit à l'oubli
- [ ] Documentation utilisateur (côté Multiwex admin)
- [ ] Tests de charge (50 conversations simultanées)

**Effort total** : ~10 jours homme.

---

## 9. Estimation tarifaire pour le client

### Setup initial (one-shot)
- Implémentation Sprints 1-5 : ~10 jours dev
- Setup compte Anthropic + intégrations Meta : 0.5 jour
- Formation Multiwex back-office : 1h

### Run mensuel (récurrent)
- Claude API : 5-20€/mois selon volume
- Embeddings : 1-2€/mois
- Pas de coût Supabase additionnel (free tier suffit pour pgvector)
- **Total : 5-25€/mois**

### Quick wins potentiels (à proposer en upsell)
- Lead capture : email collectés via chatbot → CRM (Brevo, HubSpot)
- A/B testing prompts (mesurer conversion réservation)
- Intégration WhatsApp Business (même bot, autre canal)
- Voice (Multiwex au téléphone via Twilio + Claude)

---

## 10. Points à valider avant de coder

1. **Provider IA** : Claude par défaut, ou client préfère OpenAI / Mistral (européen) ?
2. **Disponibilité** : 24/7 ou heures d'ouverture seulement ?
3. **Multilangue** : FR uniquement au début ou FR/NL/EN dès V1 ?
4. **Lead capture** : on demande email systématiquement ou seulement si conv pertinente ?
5. **Sources sociales** : on attend les credentials Meta API du client ou on commence sans ?
6. **Hébergement données conversation** : OK chez Supabase Frankfurt ou besoin d'isoler ?
7. **Modération humaine** : qui review les conversations ? Manager Multiwex ou personne ?
