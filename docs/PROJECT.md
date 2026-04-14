# Multiwex — Web App de réservation
## Documentation projet (maquette démo)

**Date** : 13 avril 2026
**Version** : 0.3 (démo)
**Repo** : https://github.com/khatcha7/multiwex-webapp
**URL prod** : https://multiwex-webapp.vercel.app
**Auteur** : Alexandre K.

Contenu du doc (10 sections)                                                                                                                                                                                                                                            
                                                                                                                                                                                                                                   
  1. Objectif — contexte démo + cibles                                                                                                                                                                                                                                       
  2. Stack technique — tableau de toutes les technos et pourquoi                                                                                                                                                                                                           
  3. Arborescence — structure complète du projet fichier par fichier                                                                                                                                                                                                         
  4. Design system — palette couleurs exacte (#ff007d etc), gradients, typo Bebas Neue, composants Tailwind custom, responsive                                                                                                                                               
  5. Fonctionnalités détaillées — chaque page/flow expliqué (accueil, booking 5 étapes, compte, admin, giftcard, email)                                                                                                                                                      
  6. Comment ça se branche à Odoo — archi recommandée + table des endpoints API à créer + méthodes XML-RPC vs REST + variables d'env + alternative iframe WordPress                                                                                                          
  7. Modifications faciles vs theme editor — tableau de ce qui se modifie via code, et proposition concrète pour une page /admin/settings Phase 2                                                                                                                            
  8. Potentiels problèmes en prod — 15 points classés 🔴 bloquants / 🟡 importants / 🟢 à surveiller (race condition créneaux, RGPD, paiement, auth admin, multilingue FR/NL/EN, monitoring, tests, a11y, etc.)                                                              
  9. Recommandations — planning Sprint 1-4 (3-4 semaines pour prod-ready) + pièges à éviter                                                                                                                                                                                  
  10. Coordonnées & annexe données activités

---

## 1. Objectif

Maquette fonctionnelle d'une web app de réservation pour le centre de loisirs Multiwex (Marche-en-Famenne).
Objectif : remplacer le module de réservation actuel — moche et peu aligné avec l'image de marque — par
une expérience moderne, mobile-first, dans les couleurs officielles (#ff007d pink signature, #000 black, #00D9FF cyan accent).

La démo permet aux collègues d'Alexandre de visualiser le futur flow de réservation et de valider le concept
avant de brancher un vrai backend (Odoo) et un vrai module de paiement (Stripe/Mollie).

---

## 2. Stack technique

| Couche | Techno | Raison |
|---|---|---|
| Framework | **Next.js 16.2** (App Router) | Rapide à dev, SSR + SSG, API routes natives, dominant Vercel |
| Langage | JavaScript (JS) | Plus simple qu'TS pour une démo, réduit le bruit |
| Styling | **Tailwind CSS 3.4** | Utility-first, responsive natif, thèmes faciles |
| Police titre | **Bebas Neue** (Google Fonts) | Proxy free de la police Multiwex Typekit |
| Police body | **Inter** (Google Fonts) | Lisibilité mobile-first |
| État global | React Context + localStorage | Simple, pas besoin de Zustand pour une démo |
| Images | `next/image` | Optimisation auto (webp, lazy, responsive) |
| Déploiement | **Vercel** (plan Hobby gratuit) | Auto-deploy à chaque `git push main` |
| Hosting DNS | Vercel ou `*.vercel.app` | URL actuelle : multiwex-webapp.vercel.app |
| Email (prod) | **Resend** | 3000 mails/mois gratuits, API simple |
| CRM backend (futur) | **Odoo** via API REST / XML-RPC | Stock, factures, clients, cartes cadeau |

---

## 3. Arborescence

```
multiwex-webapp/
├── app/
│   ├── layout.js              # Layout racine, fonts, Header+Footer
│   ├── page.js                # Accueil : hero + grille activités + CTA
│   ├── booking/page.js        # Flow de réservation (5 étapes)
│   ├── account/page.js        # Login optionnel + historique perso + KPI
│   ├── admin/page.js          # Dashboard admin (KPI, CA, top activités, stats)
│   ├── giftcard/page.js       # Achat carte cadeau
│   ├── globals.css            # Tailwind base + composants custom
│   └── api/
│       ├── send-confirmation/route.js  # Envoi email via Resend
│       └── odoo-stub/route.js          # Stub de branchement Odoo
│
├── components/
│   ├── Header.js              # Nav desktop + menu burger mobile
│   ├── Footer.js              # Contact, adresse, mentions
│   ├── ActivityLogoCard.js    # Card activité avec logo SVG centré
│   └── booking/
│       ├── StepActivities.js  # Sélection multi + quantité par activité
│       ├── StepPlayers.js     # Nombre de joueurs + auto-sessions
│       ├── StepSlots.js       # Date 60j + créneaux par durée + anti-conflit
│       ├── StepRecap.js       # Récap avec logos + code promo + form client
│       └── StepConfirm.js     # Écran de confirmation final
│
├── lib/
│   ├── activities.js          # Catalogue activités (données, prix, durées)
│   ├── hours.js               # Horaires, génération slots, anti-conflit, fake occupied
│   ├── store.js               # Context global (cart, user, sessions auto)
│   └── fakeBookings.js        # Génération réservations fake pour admin dashboard
│
├── public/images/
│   ├── brand/                 # Logos activités SVG officiels scrapés
│   │   ├── logo-full.png
│   │   ├── logo.png
│   │   ├── logo-battle-kart.svg
│   │   ├── logo-eye-start.svg
│   │   ├── logo-dark-drift.svg
│   │   ├── logo-k7.svg
│   │   ├── logo-slashhit.svg
│   │   ├── logo-buzz-quiz.svg
│   │   ├── logo-cube-3.svg
│   │   ├── logo-freedrift.svg
│   │   └── logo-starcadium.svg
│   └── activities/            # Photos hero (fallback background)
│
├── docs/
│   └── PROJECT.md             # Ce document
│
├── package.json
├── next.config.js
├── tailwind.config.js         # Palette custom Multiwex + fonts
└── README.md                  # Instructions déploiement rapide
```

---

## 4. Design system

### Couleurs
Palette extraite du thème WordPress Multiwex (fichier `main.qFm60n4c.css`).

| Nom | Hex | Usage |
|---|---|---|
| `mw-pink` | `#ff007d` | Couleur signature, CTA primary, accents, glow |
| `mw-pink-2` | `#ff0054` | Gradient secondaire, variations |
| `mw-red` | `#E40D0D` | Badges erreur, créneaux occupés |
| `mw-cyan` | `#00D9FF` | Accent subtil, gradients alternatifs |
| `mw-black` | `#000000` | Fond pur |
| `mw-dark` | `#0a0a0f` | Fond cards, éléments principaux |
| `mw-darker` | `#050508` | Fond body global |
| `white/5 → 15` | rgba | Borders, subtiles séparations |

### Gradients et effets
- **Hero** : radial gradients pink + cyan en background-attachment fixed
- **Glow "neon"** : `shadow-neon-pink` = `0 0 20px rgba(255,0,125,0.55) + 0 0 40px rgba(255,0,125,0.25)`
- **Cards sélectionnées** : border pink + shadow neon pink
- **Cards background** : gradient subtil `from-white/[0.06] to-white/[0.01]` avec image hero blurrée en backdrop

### Typographie
- **Titres & labels Multiwex** : `Bebas Neue` (classe `.display`) — grosses majuscules condensées, très proche de l'identité visuelle
- **Body** : `Inter` (système font fallback)
- **Tracking** : `wide` sur titres/labels pour l'effet uppercase soigné

### Composants UI (classes Tailwind custom)
- `.btn-primary` — bouton pink rempli avec glow au hover
- `.btn-outline` — bouton bordé qui vire pink au hover
- `.btn-danger` — bouton rouge
- `.card` / `.card-selected` — cards génériques avec border pink quand actives
- `.chip` / `.chip-pink` / `.chip-red` — badges / pills
- `.section-title` — h1 en grosses majuscules Bebas 4xl-6xl
- `.display` — texte en majuscules Bebas, pour labels et titres courts
- `.input` — inputs stylisés avec focus pink glow

### Responsive
- **Mobile-first** : tous les breakpoints partent de mobile et grandissent (`sm:` 640px, `md:` 768px, `lg:` 1024px)
- Menu burger mobile avec animation 3 traits → croix
- Grilles d'activités : 2 colonnes mobile → 3 colonnes tablet → 4 colonnes desktop
- Stepper bottom bar sticky sur mobile pour bouton Retour/Continuer toujours accessible
- Calendrier : scroll horizontal tactile avec `scrollbar-thin` rose

---

## 5. Fonctionnalités détaillées

### 5.1 Page d'accueil (`/`)
- **Hero section** avec badge, titre en 2 lignes, sous-titre explicatif, CTA pink + outline + carte cadeau
- **Grille d'activités** : 9 activités avec logos SVG officiels (BattleKart, EyeStart, DarkDrift, FreeDrift, K7 Karaoké, Slash and Hit, Buzz-e-Quiz, Cube3, Starcadium)
- **2 CTAs bottom** : "Prêt à réserver" (pink) et "Offrez une carte cadeau" (cyan)
- **BattleKart** → redirection externe vers `https://www.battlekart.com/fr/wex/booking` (pas d'API publique)
- **Starcadium** → marqué "Sans réservation" (walk-in, 300m² arcade en accès libre)

### 5.2 Flow de réservation (`/booking`)

**Étape 1 — Activités**
- Sélection multi via cartes-logos cliquables
- Après sélection, affichage d'une liste avec stepper +/− pour choisir le **nombre de parties** souhaité par activité
- Info : si le groupe dépasse la capacité max d'une activité, des créneaux additionnels seront automatiquement requis

**Étape 2 — Joueurs**
- Stepper +/− gros format, max 30 joueurs
- Affiche automatiquement combien de créneaux seront requis par activité (ex : 8 joueurs + FreeDrift max 4 → 2 créneaux FreeDrift auto)
- Indicateur `+X auto` sur les activités concernées
- Formule : `sessions = max(quantity_utilisateur, ceil(players / maxPlayers_activité))`

**Étape 3 — Créneaux**
- Calendrier 60 jours groupés par mois, scrollable horizontal
- Jours fermés grisés (Lun/Mar fermé), jours mercredi avec badge `-50%`
- **Date du jour auto-sélectionnée** au chargement, marqueur pink
- Créneaux générés selon la durée exacte de l'activité (EyeStart 20min, DarkDrift 10min, K7 2h…) — plus de grille toutes les 5 min
- Si la date est aujourd'hui : créneaux passés automatiquement filtrés (timezone locale)
- **Anti-chevauchement** : buffer de 10 minutes entre 2 activités du même panier — si EyeStart finit à 14h20, DarkDrift ne peut pas commencer avant 14h30
- **Créneaux "complet" fake** (~25% déterministes par date+activité) affichés barrés en rouge pour la démo visuelle
- Tabs par activité avec compteur `X/Y sélectionnés`
- Bouton "Effacer" par activité

**Étape 4 — Récap**
- Liste des créneaux triés par heure, avec **logo carré** de chaque activité
- Code promo : `DEMO100` = 100% de réduction (bypass paiement démo)
- Tarif mercredi -50% appliqué automatiquement selon la date
- Formulaire client : nom, email, téléphone (facultatif)
- Calcul total avec sous-total / remise / total final
- **Envoi email de confirmation** via POST `/api/send-confirmation` (Resend)

**Étape 5 — Confirmation**
- Numéro de réservation généré `MW-XXXXXX`
- Résumé final avec badge succès et glow pink
- CTA "Voir mon compte" + "Nouvelle réservation"

**Navigation** : bouton Retour disponible à chaque étape, sticky en bas sur mobile.

### 5.3 Compte utilisateur (`/account`)
- **Login optionnel** (non requis pour réserver) — juste nom + email, pas de mot de passe pour la démo
- Si connecté : dashboard perso avec **3 KPI** (nb réservations, total dépensé, membre depuis)
- **Historique** de toutes les réservations de l'user (filtrées par email)
- Affichage détaillé de chaque résa avec activités, créneaux, statut payé/impayé
- Déconnexion = vide juste localStorage

### 5.4 Dashboard admin (`/admin`)
Accès : `/admin` → code démo `admin`

- **7 presets de période** : Aujourd'hui / Hier / 7j / 30j / Ce mois / Mois passé / Tout
- **4 KPI principaux** :
  - Chiffre d'affaires avec **% d'évolution** vs période précédente (↑ vert / ↓ rouge)
  - Nombre de réservations
  - Panier moyen
  - Total joueurs
- **Stats par activité** : logo + barre de progression + parties réservées + joueurs + minutes jouées cumulées
- **Table des 20 dernières réservations** : ID, client, date, activités, total
- **200 réservations fake** générées automatiquement sur 90 jours pour avoir des données réalistes

### 5.5 Carte cadeau (`/giftcard`)
- Montants préset 20/50/100/150€ + champ custom
- **Preview live** de la carte aux couleurs Multiwex, avec valeur et noms de/pour dynamiques
- Formulaire expéditeur / bénéficiaire / email / message personnel
- Code promo `DEMO100` appliquable
- Génération code `GIFT-XXXXXXXX` unique
- Persistance localStorage, stub API `/api/odoo-stub` pour future intégration `loyalty.card` Odoo

### 5.6 Email de confirmation (`/api/send-confirmation`)
Endpoint POST qui :
- Récupère le booking du body
- Vérifie la variable d'env `RESEND_API_KEY` — si absente : mode simulation (log console, pas d'email envoyé)
- Si présente : envoie un email HTML via `https://api.resend.com/emails` avec template stylé aux couleurs Multiwex
- Customisable via variable d'env `FROM_EMAIL`
- Pour activer : compte Resend (gratuit 3000 mails/mois) + clé API ajoutée dans Vercel Settings

---

## 6. Comment ça se branche à Odoo (futur)

### Recommandation : Odoo comme backend, Next.js comme front

```
[Customer browser]
       ↓
[Next.js app sur Vercel]   ←— code sur GitHub, auto-deploy
       ↓  (API HTTP)
[Odoo SaaS / self-hosted]  ←— CRM, factures, clients, cartes cadeau
```

### Endpoints à créer (remplacer les stubs actuels)

| Route Next.js | Méthode | Action Odoo |
|---|---|---|
| `/api/bookings` | POST | Crée un `sale.order` (ou `pos.order`) dans Odoo avec les lignes d'activités |
| `/api/bookings` | GET | Lit les réservations d'un user via `res.partner` email |
| `/api/giftcards` | POST | Crée une carte cadeau dans `loyalty.card` (Odoo 17+) |
| `/api/giftcards/:code` | GET | Vérifie la validité et le solde d'une carte cadeau |
| `/api/availability` | GET | Retourne les créneaux occupés pour une date+activité (DB query) |
| `/api/admin/stats` | GET | Agrégations pour dashboard admin |

### Méthodes d'accès Odoo
- **XML-RPC** (stable, Odoo 8+) : `execute_kw('sale.order', 'create', [{...}])`
- **REST API** (Odoo 17+) : `POST /api/v1/sale.order`
- **Odoo.sh Webhook** : notifications push quand une résa change de statut

### Variables d'env à configurer (Vercel → Settings → Environment Variables)
```
ODOO_URL=https://multiwex.odoo.com
ODOO_DB=multiwex-prod
ODOO_USER=api@multiwex.be
ODOO_API_KEY=xxxxxxxxxx
RESEND_API_KEY=re_xxxxxxxx
FROM_EMAIL=Multiwex <noreply@multiwex.be>
ADMIN_PASSWORD=xxxxxx
JWT_SECRET=xxxxxx
```

### Alternative : embed dans WordPress actuel
Si Multiwex préfère garder son site WordPress, on peut embed la webapp en iframe :
```html
<iframe
  src="https://multiwex-webapp.vercel.app/booking"
  width="100%" height="900"
  style="border:0;border-radius:16px">
</iframe>
```
URL visible pour l'utilisateur : `multiwex.be/reservation` (redirection WP vers l'iframe).

---

## 7. Ce qu'on peut modifier et comment

### 7.1 Modifications rapides (via code)

| Quoi | Où | Difficulté |
|---|---|---|
| Textes, descriptions | `lib/activities.js` + composants concernés | 🟢 Facile |
| Prix, durées, capacités | `lib/activities.js` | 🟢 Facile |
| Horaires d'ouverture | `lib/hours.js` (`openingHours`) | 🟢 Facile |
| Buffer anti-conflit | `lib/hours.js` (`BUFFER_MIN = 10`) | 🟢 Facile |
| Couleurs de la palette | `tailwind.config.js` + `globals.css` | 🟢 Facile |
| Logos d'activités | Remplacer les `.svg` dans `public/images/brand/` | 🟢 Facile |
| Ajouter une activité | Ajouter un objet dans `activities[]` + son logo | 🟡 Moyen |
| Modifier le flow de réservation | Composants `StepActivities`/`StepSlots`/... | 🟡 Moyen |
| Changer le code promo démo | `StepRecap.js` (`DEMO100`) | 🟢 Facile |

Chaque modif = commit sur GitHub = auto-redéploie sur Vercel en ~1 min.

### 7.2 Theme editor (Phase 2, optionnel)

Pour permettre à tes collègues de modifier textes/couleurs/prix **sans toucher au code** :

**Proposition : page `/admin/settings`**
- Centraliser tout le contenu éditable dans un fichier `lib/config.js` (textes, couleurs, horaires, buffer, limites)
- Créer une page admin avec des formulaires simples (inputs texte, color pickers)
- Sauvegarder dans une DB légère (Vercel KV, Supabase, ou Odoo direct via API)
- Les changements apparaissent en temps réel sur le site

**Effort estimé** : 1-2 jours de dev. À faire une fois la démo validée.

**Ce que ça NE sera PAS** : un WYSIWYG drag & drop complet (type Elementor). Pour ça, autant embed la webapp dans WordPress qui a déjà ce genre d'outil.

---

## 8. Potentiels problèmes en production (grosse société)

Liste honnête des points à résoudre avant mise en production pour un business réel.

### 🔴 Bloquants

| # | Problème | Impact | Solution |
|---|---|---|---|
| 1 | **Race condition sur les créneaux** : 2 users qui réservent le même slot en même temps passent tous les deux avec le localStorage actuel | Double-booking possible | Passer à une DB centrale (Postgres/Supabase/Odoo) avec lock optimiste ou transaction SQL |
| 2 | **RGPD** : pas de consentement cookies, pas de politique de données, pas de droit à l'oubli | Amende possible (4% CA annuel) | Ajouter bannière cookies (CMP type Cookiebot), page légales, mécanisme d'export/suppression des données |
| 3 | **Paiement réel** non branché | Démo bloquée par DEMO100 | Intégrer Stripe/Mollie/Adyen — gestion échecs, remboursements, 3D Secure |
| 4 | **Auth admin en dur** (`admin` hardcodé en clair) | Vulnérabilité sécu majeure | NextAuth + vraie DB users + 2FA + bcrypt |

### 🟡 Importants

| # | Problème | Impact | Solution |
|---|---|---|---|
| 5 | **Multilingue manquant** (FR/NL/EN obligatoire en Belgique) | Perte clients NL + flamands | Next.js i18n + fichiers de traduction |
| 6 | **Pas de monitoring** (erreurs / crashes silencieux) | Bugs prod invisibles | Sentry + Vercel Analytics + logs structurés |
| 7 | **Pas de tests automatisés** | Régressions à chaque modif | Vitest + Playwright pour tests e2e du flow de résa |
| 8 | **Accessibility (WCAG)** non auditée | Exclusion handicap + risques légaux | Audit axe-core, ajouter `aria-*`, contrastes, focus visible |
| 9 | **Pas de rate limiting** sur les API routes | DDoS facile, scraping | Vercel Edge Middleware + Upstash Redis |
| 10 | **Validation côté client uniquement** | Données corrompues possibles | Zod schemas + validation serveur dans `/api/*` |

### 🟢 À surveiller

| # | Problème | Impact | Solution |
|---|---|---|---|
| 11 | **Plan Vercel Hobby** limité (100 GB bandwidth/mois, fonctions limitées) | Down si gros pic de traffic | Passer en plan Pro 20$/mois |
| 12 | **Taille SVG** : certains logos font 48-97 kB | Loading légèrement lent mobile 3G | SVGO compression (gain ~50%) |
| 13 | **Pas de CDN custom images** | Latence asie/amériques | Vercel image optimization déjà en place, suffisant pour BE |
| 14 | **Emails non whitelist** | Risque spam box | Configurer SPF/DKIM/DMARC sur `multiwex.be` via Resend Domains |
| 15 | **Localisation timezone** | Créneaux faux si user hors Europe/Brussels | Forcer TZ serveur en Europe/Brussels |

---

## 9. Recommandations

### 9.1 Pour la démo aux collègues (maintenant)
- ✅ Le site est en ligne sur https://multiwex-webapp.vercel.app — partage le lien
- ✅ Code d'accès admin : `admin` (à changer avant de partager si tu veux le masquer)
- ✅ Code promo démo : `DEMO100` (à mentionner dans la présentation)
- ✅ Activer Resend pour envoi email réel (3000 mails gratuits) — voir section 7 README
- 💡 Tester le flow en conditions réelles : téléphone mobile + desktop, chemins heureux + erreurs

### 9.2 Pour passer en production
**Ordre de priorité suggéré** :

**Sprint 1 — Backend robuste (1-2 semaines)**
1. Brancher Odoo via API (sale.order + res.partner + loyalty.card)
2. Ajouter DB Postgres (Supabase/Neon) pour lock des créneaux + cache read-only
3. Authentification admin propre (NextAuth) + rôles

**Sprint 2 — Paiement + légal (1 semaine)**
4. Intégration Stripe ou Mollie
5. RGPD : cookie banner, page légales, export/delete data
6. SPF/DKIM pour emails via domaine multiwex.be

**Sprint 3 — Multilingue + monitoring (1 semaine)**
7. i18n FR/NL/EN
8. Sentry + Vercel Analytics
9. Rate limiting API
10. Audit accessibilité + corrections

**Sprint 4 — Theme editor (optionnel, 1-2 jours)**
11. Page `/admin/settings` pour édition des textes et prix sans code

**Effort total estimé** : 3-4 semaines dev full-time pour une version production-ready.

### 9.3 Pour éviter les pièges
- ❌ **Ne pas** essayer de tout mettre dans Odoo. Odoo est puissant mais son UI customer n'est pas à la hauteur de ce qu'on peut faire en Next.js.
- ❌ **Ne pas** supprimer le module de réservation BattleKart existant — il a son propre système. Garder la redirection externe comme fait actuellement.
- ❌ **Ne pas** activer les emails réels avant d'avoir vérifié le domaine dans Resend (sinon spam assuré).
- ✅ **Garder** le repo GitHub comme source unique de vérité.
- ✅ **Utiliser** les preview deployments Vercel (URL par branche) pour valider les changements avant merge en main.
- ✅ **Documenter** chaque variable d'env dans un fichier `.env.example` committé.

---

## 10. Coordonnées de référence

- **Site Multiwex officiel** : https://www.multiwex.be/fr/
- **Module de résa existant (référence à remplacer)** : `booking.multiwex.be`
- **Module BattleKart (à garder externe)** : https://www.battlekart.com/fr/wex/booking
- **Adresse physique** : Rue des Deux Provinces 1, 6900 Marche-en-Famenne
- **Téléphone** : +32 (0)84 770 222
- **Email** : info@multiwex.be

---

## Annexe — Données activités réelles (scrapées de multiwex.be le 13/04/2026)

| Activité | Durée | Prix normal | Prix mercredi | Max joueurs | Réservable |
|---|---|---|---|---|---|
| BattleKart | 30 min* | — | — | 10 | ❌ Externe |
| EyeStart | 20 min | 19€ | 10€ | 8 | ✅ |
| DarkDrift | 10 min | 10€ | 5€ | 6 | ✅ |
| FreeDrift | 8 min | 8€ | 4€ | 4 | ✅ |
| K7 Karaoké | 120 min | 15€ | 7.50€ | 18 (dancefloor) | ✅ |
| Slash and Hit | 60 min | 19€ | 10€ | 6 | ✅ |
| Buzz-e-Quiz | 60 min | 19€ | 10€ | 12 | ✅ |
| Cube3 | 15 min | 10€ | 5€ | 6 | ✅ |
| Starcadium | libre | crédits | crédits x2 | 100 | ❌ Walk-in |

*\* BattleKart : durée approximative, le vrai module gère ses propres créneaux.*

---

**Fin du document.**
Pour toute question ou modification : Alexandre K. + Claude Code.
