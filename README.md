# Multiwex — Web App de réservation (maquette démo)

Maquette fonctionnelle de réservation multi-activités pour Multiwex (Marche-en-Famenne).
Stack : **Next.js 15** (App Router) + **Tailwind CSS** · déploiement **Vercel** gratuit.

## Fonctionnalités

- Page d'accueil avec grille d'activités (données et images réelles scrapées du site officiel)
- Flow de réservation en 5 étapes :
  1. Sélection multi-activités
  2. Nombre de joueurs (unique pour toutes les activités)
  3. Date + créneaux par activité (anti-chevauchement + buffer 10 min entre activités)
  4. Récapitulatif + code promo
  5. Confirmation avec numéro de réservation
- **Code promo démo** : `DEMO100` (100 % de réduction, bypass paiement)
- **Tarif mercredi -50 %** appliqué automatiquement selon la date sélectionnée
- Redirection externe pour **BattleKart** (vers `battlekart.com/fr/wex/booking`)
- **Starcadium** affiché comme walk-in (non réservable)
- **Compte utilisateur optionnel** (pas requis pour réserver) avec historique des réservations
- **Dashboard admin** avec KPI chiffres d'affaires, top activités, 80 réservations fake générées
  (accès : `/admin`, code `admin`)
- Responsive mobile-first aux couleurs Multiwex (#00D9FF cyan, #E40D0D rouge, thème sombre)

## Règles de réservation

- Capacités max par activité : EyeStart 8, DarkDrift 6, FreeDrift 4, K7 18, Slash&Hit 6, BuzzeQuiz 12, Cube3 6
- Durées réelles : EyeStart 20min, DarkDrift 10min, FreeDrift 8min, K7 120min, Slash&Hit 60min, BuzzeQuiz 60min, Cube3 15min
- Prix normaux / mercredi : tous scrapés depuis les pages activité de multiwex.be
- Conflit horaire : si une activité se termine à 14h15, la suivante ne peut commencer qu'à 14h25 minimum (buffer 10min)
- Horaires d'ouverture : Lun/Mar fermé · Mer 12h-21h · Jeu 14h-22h · Ven 14h-23h · Sam 10h-23h · Dim 10h-20h

## Lancer en local

```bash
npm install
npm run dev
# ouvrir http://localhost:3000
```

## Déployer sur Vercel (gratuit, 2 minutes)

Le repo est déjà sur GitHub : https://github.com/khatcha7/multiwex-webapp

1. Va sur **https://vercel.com/new**
2. Se connecter avec ton compte GitHub
3. Cliquer **Import** sur le repo `khatcha7/multiwex-webapp`
4. Laisser les réglages par défaut → **Deploy**
5. URL publique disponible sous ~1 min (format `multiwex-webapp-<hash>.vercel.app`)

Alternative en CLI :
```bash
npm i -g vercel
cd ~/multiwex-webapp
vercel    # suit le login device-code puis déploie
```

## Intégration future Odoo + WordPress

Le code est structuré pour brancher Odoo facilement :

- **`lib/store.js`** → fonction `saveBooking()` isolée qui actuellement écrit en `localStorage`.
  Remplacer par un `fetch('/api/bookings', { method: 'POST', body: JSON.stringify(booking) })`
- **Créer `app/api/bookings/route.js`** qui :
  - crée un lead/devis dans Odoo via XML-RPC (`execute_kw`) ou l'API REST Odoo 17+
  - envoie l'email de confirmation (Nodemailer ou service externe Resend/Sendgrid)
- **WordPress** : embed l'app via iframe sur une page WP, ou utiliser le lien direct
  `booking.multiwex.be/booking`. Pour passer l'identité utilisateur, propager un JWT WP en header.

Variables d'env à prévoir pour la prod :
```
ODOO_URL=https://multiwex.odoo.com
ODOO_DB=multiwex
ODOO_USER=api@multiwex.be
ODOO_API_KEY=...
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
```

## Arborescence

```
app/
  page.js               # Accueil
  booking/page.js       # Flow réservation orchestrateur
  account/page.js       # Compte utilisateur + historique
  admin/page.js         # Dashboard admin
components/
  Header.js, Footer.js
  booking/
    StepActivities.js
    StepPlayers.js
    StepSlots.js        # Logique anti-chevauchement + buffer
    StepRecap.js        # Code promo DEMO100
    StepConfirm.js
lib/
  activities.js         # Catalogue + helpers prix mercredi
  hours.js              # Horaires, slot generation, conflict detection
  store.js              # Context global (panier, user, persistance localStorage)
  fakeBookings.js       # Génération historique fake pour dashboard admin
public/images/
  brand/                # Logos Multiwex
  activities/           # Images hero scrapées
```

## Limites actuelles

- Persistance locale (`localStorage`) — les réservations ne sont pas partagées entre appareils.
  Pour le démo c'est volontairement simple. Brancher une DB (Postgres Supabase/Neon) + Odoo pour la prod.
- Email de confirmation simulé (pas d'envoi réel). Pour activer : ajouter `/api/send-confirmation` avec Nodemailer.
- Horaires d'ouverture en dur (approximation sur la base du calendrier du site).
  À synchroniser avec l'API/calendrier réel de Multiwex pour la prod.
