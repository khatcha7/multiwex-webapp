# Multiwex Webapp — Handbook complet

> Document de référence pour l'équipe interne (dev/tech) + base de pitch pour le client.
> Couvre : architecture, sécurité, intégrations Odoo, options email, déploiement, alternatives.
>
> Dernière mise à jour : 2026-04-19

---

## Table des matières

1. [Vue d'ensemble — ce qu'on a construit](#1-vue-densemble)
2. [Architecture technique](#2-architecture-technique)
3. [Stack & justification de chaque brique](#3-stack--justification)
4. [Sécurité & conformité RGPD](#4-sécurité--rgpd)
5. [Intégration Odoo — scénarios](#5-intégration-odoo)
6. [Envoi d'emails — Resend recommandé + alternatives](#6-envoi-demails)
7. [Workflow déploiement (GitHub → Vercel)](#7-déploiement)
8. [Hébergement : cloud vs on-premise](#8-hébergement)
9. [Réponses aux objections client](#9-objections-client)
10. [Comparaison avec SaaS booking concurrents](#10-saas-concurrents)
11. [Roadmap pour passer en production](#11-roadmap-prod)

---

## 1. Vue d'ensemble

### Ce qu'on a construit
Une **webapp de réservation multi-activités** pour Multiwex (centre de loisirs Marche-en-Famenne) avec :

**Côté client (public)**
- Funnel de réservation en ligne (catalogue, créneaux temps réel, paiement)
- Compte client (historique réservations, cartes cadeaux, factures téléchargeables)
- Achat carte cadeau
- Mail de confirmation HTML brandé + facture PDF + .ics agenda

**Côté staff (back-office)**
- Calendrier multi-activités avec détection collision multi-salles
- Réservation sur place (front desk)
- Gestion blocages créneaux (privatisation, maintenance)
- Système de notes par jour/plage/créneau
- Filtrage par catégories
- Réglages éditables (entreprise, mails, factures, cross-sell, infos pratiques)
- Audit log de toutes les actions staff

**Automatisations**
- Mail de confirmation après chaque résa (online + on-site)
- Mail carte cadeau avec voucher PDF brandé
- Mail post-visite J+1 avec lien Google Reviews (cron quotidien)
- Synchronisation temps réel entre tous les écrans staff

### Volume traité
- ~6000 m² indoor, ~10 activités, plusieurs salles par activité
- Capacité estimée : centaines de réservations/jour
- Architecture conçue pour scale jusqu'à plusieurs milliers/jour sans changement

---

## 2. Architecture technique

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT (browser)                    │
│  Public booking · Account · Staff back-office (PWA)     │
└────────────────────┬───────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼───────────────────────────────────┐
│              VERCEL (Frontend + APIs)                  │
│  - Next.js 16 (React 19) — SSR + ISR                  │
│  - Edge & Node.js serverless functions                │
│  - Auto-déploiement depuis GitHub                     │
│  - CDN global (latence faible Europe)                 │
└─┬──────────┬──────────┬──────────────────┬───────────┘
  │          │          │                  │
  │      Resend     Supabase            (Odoo
  │      (Email)    (Database)          futur)
  │                                      
┌─▼─────────────────────────────────────────────────────┐
│   SUPABASE (Postgres + Realtime + Storage)            │
│  - Tables : bookings, customers, slot_blocks,         │
│             notes, giftcards, site_config, audit_log  │
│  - Realtime : sync calendrier multi-staff             │
│  - Hébergement Frankfurt (EU) — RGPD compliant        │
│  - Backups quotidiens automatiques                    │
└────────────────────────────────────────────────────────┘
```

### Flux de réservation (online)
1. Client choisit ses créneaux sur `/booking`
2. Vérification disponibilité via Supabase (multi-user safe : transactions atomiques)
3. Création `booking` + `booking_items` en DB
4. Trigger API `/api/send-confirmation`
5. → API génère facture PDF + .ics + HTML mail
6. → Resend envoie le mail avec PJ
7. Cron quotidien (10h UTC) trouve les résas d'hier non flaggées et envoie le mail post-visite

### Flux de réservation (on-site staff)
Identique au flux online sauf que c'est un staff qui saisit (paiement carte/cash sur place). Mêmes APIs, même mail de confirmation.

---

## 3. Stack & justification

| Brique | Choix | Pourquoi | Alternatives écartées |
|---|---|---|---|
| **Framework web** | Next.js 16 (React 19) | Standard de l'industrie, SSR + SSG, écosystème énorme, hot reload, TypeScript-ready | Remix (moins mature), Nuxt (Vue, moins demandé), pure React (pas de SSR) |
| **Hébergement frontend** | Vercel | Créateur de Next.js, déploiement zéro-config, CDN global, scaling auto, gratuit jusqu'à un certain volume | Netlify (équivalent), AWS Amplify (plus complexe), self-hosted (effort opérationnel énorme) |
| **Base de données** | Supabase (Postgres) | Postgres = standard SQL le plus solide, hébergé EU (Frankfurt), Realtime intégré, RLS row-level security, gratuit jusqu'à 500MB | Firebase (NoSQL, vendor lock-in Google), MongoDB (NoSQL, moins adapté), Postgres self-hosted (effort ops) |
| **Envoi email** | Resend | API moderne, dashboard clair, 3000 mails/mois gratuits, focus délivrabilité | SendGrid (plus complexe, owned by Twilio), Mailgun (UI vieillotte), Postmark (excellent mais payant), AWS SES (très technique) |
| **PDF génération** | @react-pdf/renderer | Templates en JSX, branding facile, fonctionne server-side Node.js | Puppeteer (lourd, headless Chrome), pdfkit (impératif), wkhtmltopdf (deprecated) |
| **Versioning** | GitHub | Standard mondial, intégration Vercel native | GitLab (équivalent), Bitbucket (moins populaire) |

### Justification du choix Supabase vs Firebase/MongoDB
Supabase = Postgres "sans la complexité" : on garde tout l'écosystème SQL (jointures, transactions, vues, row-level security, contraintes de FK) avec une API REST/Realtime générée. Postgres permet de faire des reportings comptables propres, exporter en CSV/Excel, brancher sur n'importe quel outil BI.

Firebase aurait été plus rapide à démarrer mais :
- NoSQL → joins faits côté client = lent et fragile
- Vendor lock-in fort (impossible de migrer facilement)
- Pas de SQL → reporting impossible
- Hébergement Google US par défaut (problème RGPD)

---

## 4. Sécurité & RGPD

### Couches de sécurité actuelles

**Réseau / transport**
- HTTPS partout (TLS 1.3) — certificats Let's Encrypt auto-renouvelés via Vercel
- HSTS activé (force HTTPS)
- Aucun mot de passe ou donnée sensible en query string

**Authentification**
- Staff : login local avec mot de passe (à brancher sur Supabase Auth pour la prod)
- Client : auth par email (sans mot de passe pour l'instant — magic link possible via Supabase)
- Sessions navigateur via httpOnly cookies (pas accessible JS)

**Base de données**
- Connexion Supabase via TLS uniquement
- Clés API : anon key (public, lecture limitée) vs service role key (server-side uniquement, jamais exposée au browser)
- Variables d'env stockées chiffrées dans Vercel
- Backups automatiques quotidiens (rétention 7 jours sur free, 30+ sur paid)
- Possibilité d'activer Row Level Security (RLS) Postgres pour isolation par client/staff

**Code**
- Pas de SQL injection possible (queries via ORM Supabase = paramétrisées)
- Pas de XSS (React échappe automatiquement, on utilise `dangerouslySetInnerHTML` uniquement sur HTML pré-validé Tiptap)
- Pas de secrets dans le repo (toutes les clés en env vars)
- Audit log de toutes les actions staff (qui a fait quoi, quand)

**Email (anti-spoofing)**
- À configurer en prod : SPF + DKIM + DMARC sur le domaine `multiwex.be`
- Empêche que quelqu'un envoie des mails "de" multiwex.be sans autorisation
- Améliore aussi la délivrabilité

### Conformité RGPD

**Données personnelles collectées**
- Nom, prénom, email (obligatoires pour réserver)
- Téléphone (optionnel)
- Adresse + n° entreprise (si réservation B2B)
- Historique des réservations

**Hébergement**
- Supabase : datacenter Frankfurt (Allemagne) → 100% EU
- Vercel : edges multiples, mais possible de pinner sur Europe via config (pour serverless functions)
- Resend : datacenter US par défaut, MAIS option EU disponible (à activer dans le compte Resend pour conformité stricte)

**Droits utilisateurs (à implémenter en V2)**
- Droit d'accès : déjà couvert par le compte client
- Droit à l'oubli : à implémenter (bouton "supprimer mon compte" qui anonymise les bookings)
- Export de données : à implémenter (export JSON/CSV du compte)
- Politique de confidentialité : page `/cgv` existe, à enrichir avec mentions RGPD

**Accord IA (point soulevé par client)**
- Aucune IA n'a accès aux données du système : Supabase et Vercel ne loggent rien dans des modèles d'IA tiers
- Resend ne lit pas le contenu des mails (juste le routing)
- Si le client veut garantie écrite : signer un DPA (Data Processing Agreement) avec Supabase + Vercel + Resend (gratuit, formulaire en ligne)

**Le client peut être 100% rassuré sur la confidentialité** : tout est hébergé en infrastructure EU (sauf Resend default, modifiable), aucune IA n'a accès aux données, et chaque fournisseur (Supabase/Vercel/Resend) est compliant RGPD avec DPA disponible sur simple demande.

---

## 5. Intégration Odoo

Le client utilise Odoo pour leur compta + ERP. Plusieurs scénarios d'intégration possibles, du plus léger au plus profond.

### Scénario A — **Webapp standalone, sync Odoo périodique** (recommandé pour démarrer)

```
Webapp ─→ Supabase (source de vérité réservations)
                │
                │ sync nightly via API
                ▼
              Odoo (factures + compta)
```

**Comment** : un cron quotidien lit les nouveaux bookings dans Supabase, crée les `sale.order` correspondants dans Odoo via XML-RPC ou REST API.

**Avantages** :
- Webapp découplée d'Odoo (continue de marcher si Odoo down)
- Pas de dépendance à la version Odoo
- Un seul endroit à maintenir (la webapp)

**Limites** :
- Décalage 24h sur la compta
- Si client modifie le booking dans Odoo, pas reflété dans la webapp (sync 1-way)

**Effort** : 2-3 jours dev pour le connecteur

### Scénario B — **Odoo source de vérité, webapp comme front** (intégration profonde)

```
Webapp ─→ API Odoo (lecture/écriture en temps réel)
              │
            Odoo (DB centrale)
```

**Comment** : la webapp ne stocke rien (ou très peu). Toutes les opérations passent par l'API Odoo. Supabase devient un cache + couche realtime.

**Avantages** :
- Une seule source de vérité (Odoo)
- Compta toujours à jour
- Si client gère via Odoo (backoffice classique) → reflété immédiatement sur la webapp

**Limites** :
- Latence : API Odoo = ~200-500ms par requête
- Disponibilité : si Odoo down, la webapp est down
- Couplage fort à la version Odoo
- Capacité Odoo limitée si gros volumes (Odoo n'est pas conçu pour 1000+ req/min)

**Effort** : 1-2 semaines dev pour la couche d'abstraction

### Scénario C — **Synchronisation bidirectionnelle temps réel** (scenario premium)

```
Webapp ⇄ Supabase ⇄ Odoo
        (sync events)
```

**Comment** : webhooks Odoo → Supabase et Supabase Realtime → Odoo via API. Tout reste en sync à la milliseconde.

**Avantages** :
- Best of both worlds
- Webapp rapide (Supabase) + compta à jour (Odoo)
- Robuste si une des 2 plateformes a une panne

**Limites** :
- Architecture complexe à maintenir
- Risque de conflits si modif simultanée 2 endroits → besoin de logique de réconciliation

**Effort** : 3-4 semaines dev + monitoring

### Notre recommandation : Scénario A

Pour Multiwex on recommande **A** (sync nightly Webapp → Odoo) car :
1. Démarrage rapide (2-3j vs 2-3 semaines)
2. Webapp = expérience client critique → ne doit jamais être bloquée par Odoo
3. La compta n'a pas besoin d'être en temps réel (J+1 suffit)
4. Si plus tard ils veulent du temps réel, on peut passer en C sans casser A

### Modules Odoo concernés

| Module Odoo | Usage |
|---|---|
| `sale.order` | Réservation = devis confirmé |
| `account.move` | Facture client générée auto |
| `res.partner` | Client (création si nouveau email) |
| `pos.order` | Pour les paiements sur place |
| `product.template` | Catalogue activités (peut être source pour la webapp) |

### Question importante à poser au client
**Versions Odoo** : Community ou Enterprise ? Quelle version (16, 17, 18) ? On-premise ou Odoo Online (SaaS) ? Cela conditionne le type d'API disponible.

---

## 6. Envoi d'emails

### Le problème de la délivrabilité

Envoyer un email "depuis un serveur" n'est pas comme envoyer depuis Gmail. Les serveurs mail destinataires (Gmail, Outlook, Yahoo) **rejettent ou spamment automatiquement** les mails dont ils ne peuvent pas vérifier l'identité du serveur émetteur. 3 vérifications standard :

- **SPF** (Sender Policy Framework) : "ce serveur a-t-il le droit d'envoyer des mails au nom de `multiwex.be` ?"
- **DKIM** (DomainKeys Identified Mail) : "ce mail a-t-il une signature cryptographique valide signée par `multiwex.be` ?"
- **DMARC** : "que faire si SPF ou DKIM échouent ?"

Sans ces 3 configurés dans le DNS du domaine → **spam quasi garanti**.

### Choix recommandé : Resend

**Resend** = service moderne d'envoi d'emails transactionnels. Concurrents directs : SendGrid, Mailgun, Postmark, AWS SES.

**Pourquoi Resend** :
- API simple et moderne (vs SendGrid qui est legacy)
- Dashboard clair pour voir l'historique d'envoi
- 3000 mails/mois gratuits, ~20€/mois ensuite (au-delà 50 000)
- Bonne réputation IP chez Gmail/Outlook
- Vérification de domaine en 5 min (3 DNS records à coller)
- Compliant RGPD avec option EU datacenter

**Setup nécessaire en prod** :
1. Créer compte Resend (gratuit)
2. Ajouter le domaine `multiwex.be` dans Resend
3. Resend donne 3 lignes DNS (SPF + DKIM + DMARC) à ajouter dans le DNS du domaine
4. Configurer dans la webapp : `from: reservations@multiwex.be`
5. → Mails envoyés à n'importe qui, en inbox

### Alternatives à Resend

| Service | Prix | Avantages | Inconvénients |
|---|---|---|---|
| **SendGrid** | Free 100/jour, payant ensuite | Énorme historique, fiable | UI vieillotte, doc complexe, owned Twilio |
| **Mailgun** | Free 100/jour, payant | Très technique, granulaire | Pas pour débutants |
| **Postmark** | Pas de free tier, 15$/mois pour 10k | Excellente délivrabilité | Cher pour petits volumes |
| **AWS SES** | $0.10/1000 mails | Très peu cher, infra Amazon | Très technique à setup, pas de UI |
| **Brevo (ex-Sendinblue)** | Free 300/jour | Belge à l'origine, marketing + transac | Marketing-oriented, transac pas sa spécialité |
| **Mailjet** | Free 200/jour | UI propre | Pas le meilleur en délivrabilité |

### Et si le client refuse tout service tiers ?

Possible mais **fortement déconseillé**. Options :

**Option 1 — SMTP direct via leur propre serveur**
- Utiliser leur Exchange/serveur mail interne (s'ils en ont un)
- Branchement via Nodemailer dans l'API
- Effort : 2-3j de config + tests

⚠ **Risque énorme** : leur serveur mail interne n'est probablement pas configuré pour envoyer 100+ mails/jour. Reputation IP médiocre → spam Gmail systématique. Pas de monitoring. Pas de retry intelligent.

**Option 2 — SMTP via leur fournisseur d'hébergement web (OVH, Combell, etc.)**
- La plupart des hébergeurs offrent un relais SMTP basique
- Limites : 200-500 mails/jour, pas de stats, IP partagée avec spam d'autres clients

**Option 3 — Microsoft 365 / Google Workspace SMTP**
- Si le client utilise déjà Office 365 ou Google Workspace pro
- Limite Microsoft : 30 mails/min, 10 000/jour
- Limite Google : 2 000/jour
- Délivrabilité : excellente (IP Microsoft/Google)
- Setup : quelques minutes (créer un app password)
- ⚠ Attention : les mails partent comme étant envoyés "personnellement" depuis leur compte, peut être bizarre

### Notre recommandation
**Resend en prod**. C'est l'industrie standard pour ce type de webapp. L'argument anti-tiers ne tient pas (Resend = juste un transporteur, comme La Poste pour des colis : il ne lit pas le contenu).

Si vraiment le client est butté contre tout service tiers : **Option 3 (Google Workspace SMTP)** car ils l'utilisent probablement déjà.

### Statut actuel
- ✅ Code prêt pour Resend (intégré dans `/api/send-confirmation`, `/api/send-giftcard`, `/api/send-postvisit`)
- ⏳ En attente de l'accès DNS au domaine `multiwex.be` pour vérifier le domaine Resend
- En attendant : envoi possible uniquement vers l'email du compte Resend (limite anti-abus de Resend)

---

## 7. Déploiement (workflow GitHub → Vercel)

### Workflow actuel

```
[Dev local] ─git push─→ [GitHub repo] ─webhook─→ [Vercel]
                                                      │
                                          ┌───────────┴───────────┐
                                          │                       │
                                    Branche main             Toute autre branche
                                          │                       │
                                          ▼                       ▼
                                    Déploiement              Déploiement
                                    Production               Preview
                                  (URL stable)              (URL temporaire)
```

### Avantages de cette approche
- **Versioning complet** : chaque modification est un commit Git, traçable, annulable (`git revert`)
- **Preview avant prod** : chaque branche feature crée une URL preview testable avant merge
- **Rollback en 1 clic** : Vercel garde tous les déploiements, on peut revenir 30s en arrière
- **Aucun downtime** : déploiement atomique (la nouvelle version est prête avant de switcher)
- **Cache CDN global** : pages statiques servies depuis 100+ edges dans le monde

### Que se passe-t-il quand on modifie la webapp ?
1. Dev modifie du code, fait `git commit` + `git push`
2. GitHub notifie Vercel (webhook automatique)
3. Vercel `npm install` + `npm run build` (~30-60s)
4. Si build OK → nouvelle version déployée (atomic switch)
5. Si build KO → ancienne version reste en place, notification d'erreur

### Et les modifications faites depuis l'admin webapp (settings) ?
- Stockées dans Supabase (table `site_config`)
- Pas besoin de redéployer
- Visibles immédiatement par tous les utilisateurs (sync realtime possible)

### Et si le client veut tout sur leur infra interne ?
Voir section [8. Hébergement](#8-hébergement).

### Question fréquente : "Et si on fait un changement dans Odoo, ça se reflète dans la webapp ?"
Cela dépend du scénario d'intégration choisi (voir [section 5](#5-intégration-odoo)) :
- **Scénario A** : non, sync uniquement webapp → Odoo (1-way)
- **Scénario B** : oui, en temps réel (Odoo = source de vérité)
- **Scénario C** : oui, en temps réel (sync bidirectionnelle)

---

## 8. Hébergement

### Configuration actuelle (recommandée)

```
GitHub (code)  ─→  Vercel (frontend + API)  ─→  Supabase (DB)  ─→  Resend (mails)
   gratuit             gratuit < 100GB              gratuit < 500MB     gratuit < 3000/mois
```

Coût total à l'échelle Multiwex : **0 à 50€/mois** selon le volume.

**Avantages cloud** :
- Aucune ops à gérer (pas de serveur à patcher, monitorer, sauvegarder)
- Scaling automatique (Black Friday → infra ajustée toute seule)
- HTTPS, CDN, DDoS protection inclus
- SLA 99.99% garanti par les fournisseurs

### Alternative — On-premise (tout sur l'infrastructure du client)

Faisable mais nécessite :
- Serveur Linux dédié (chez eux ou loué) avec accès root
- Docker / Kubernetes pour orchestrer
- Stack à installer/maintenir : Node.js, Postgres, Nginx, Redis (cache), service mail (Postfix)
- Certificats SSL à gérer (Let's Encrypt)
- Backups manuels à scheduler
- Monitoring (Prometheus + Grafana ou équivalent)
- Sécurité réseau : firewall, fail2ban, mises à jour OS

**Effort initial** : 1-2 semaines pour setup complet
**Coût récurrent** : ~50-200€/mois serveur + temps de maintenance (1-2 jours/mois)
**Risque** : panne hardware, faille sécurité, perte données si pas de bonne politique de backup

### Hybride (le client veut garder la DB chez lui)

Possible : webapp sur Vercel, Postgres on-premise chez le client + tunnel sécurisé.

**Avantages** :
- Données restent physiquement chez le client (argument fort RGPD/sécurité)
- Scaling/CDN du frontend reste géré par Vercel

**Limites** :
- Latence réseau (Vercel → DB client → réponse)
- Le client doit avoir une IP publique stable + cert SSL valide
- Plus complexe à debugger

### Notre recommandation pour Multiwex
**Stack actuel (Vercel + Supabase + Resend)** car :
- Coût marginal vs on-premise
- Zéro maintenance opérationnelle
- Sécurité gérée par les meilleurs spécialistes du marché
- Tout en EU (RGPD compliant)
- Si plus tard ils veulent migrer : Postgres standard = portable n'importe où

---

## 9. Réponses aux objections client

### "Et si Vercel/Supabase ferme demain ?"
- Code 100% portable (Next.js + Postgres = standards). Migration vers AWS/Azure/Hetzner en quelques jours
- Backups DB téléchargeables à tout moment (format SQL standard)
- Aucun lock-in propriétaire (à l'inverse de Firebase, Wix, Squarespace)

### "On veut pas que nos données partent aux US"
- Supabase Frankfurt (EU) ✅
- Vercel : edges distribuées mais serverless functions peuvent être pinnées EU
- Resend : option EU disponible (à activer)
- DPA (Data Processing Agreement) signable avec chacun des 3
- Aucune donnée client ne sort de l'EU si bien configuré

### "Pourquoi pas Odoo direct pour la réservation ?"
- Odoo a un module booking mais : UX/UI vieillotte, pas mobile-first, customisation limitée, lent sur mobile, pas de realtime multi-staff
- Notre webapp = expérience client moderne (Lazada/Booking.com level)
- Odoo reste la référence comptable, on s'y branche

### "Combien ça coûte par mois en run ?"
- 0 à 100€/mois pour 95% des centres de loisirs taille Multiwex
- Cap à ~300€/mois si très gros volume (>50 000 mails/mois, >500GB DB)

### "Sécurité : et si quelqu'un hack ?"
- HTTPS partout, mots de passe hashés (jamais en clair), audit log complet
- Vercel/Supabase ont des équipes sécu dédiées 24/7 (impossible à reproduire en interne)
- Possibilité d'activer 2FA sur le back-office staff
- Backups quotidiens permettent de restaurer en cas de problème

### "Mon collègue est dev, il peut maintenir lui-même ?"
- Oui, le repo est sur GitHub, accès partageable. Stack standard (Next.js + Supabase) = très demandée, énormément de doc en ligne
- Onboarding d'un dev externe : ~2-3 jours pour comprendre l'archi
- Le code suit les conventions standards (pas de magie, pas de framework custom)

### "Et l'IA dans tout ça ? On veut pas que nos données soient utilisées pour entraîner des modèles"
- **Aucune des briques utilisées (Supabase, Vercel, Resend, Postgres) n'envoie de données vers des modèles d'IA**
- Vercel a une politique stricte : aucune donnée client utilisée pour l'IA
- Supabase = juste de la DB hébergée, ne lit pas le contenu
- Resend = juste du routage mail, ne lit pas le contenu
- Si on développe une feature IA plus tard (ex: recommandations), on demandera consentement explicite

### "On peut garder le contrôle complet ?"
- Code source = propriété client (livrable Git complet)
- Données = exportables à tout moment (CSV, SQL dump)
- Aucune dépendance à nous (devs) pour faire tourner le système
- Documentation complète fournie

---

## 10. SaaS concurrents (le marché belge/européen)

### Le SaaS belge mentionné par le client
Sans plus de détails, hypothèses (à confirmer avec le client) :

**Hypothèse 1 — TeamLeader** (Gand, Belgique)
- Suite SaaS : CRM, devis, factures, projets, time tracking, signature électronique, helpdesk
- ~8-10 modules
- Cher : 50-80€/user/mois
- Pas spécialisé booking de loisirs (orienté agences/services B2B)

**Hypothèse 2 — Combell / Optos** (hosting belge)
- Plutôt hébergement que SaaS booking, peu probable

**Hypothèse 3 — Lightspeed** (origine belge, racheté)
- POS + booking + e-commerce
- 8-12 modules selon les industries (Retail, Restaurant, Golf)
- Adapté loisirs : oui (Golf, leisure)
- Cher : 100-200€/mois minimum

### Comparaison avec notre solution

| Critère | Notre webapp custom | TeamLeader | Lightspeed | Bookkit/Combo |
|---|---|---|---|---|
| Adapté loisirs multi-activités | ✅ Sur mesure | ❌ Non | ⚠ Partiel | ⚠ Standard |
| Branding 100% Multiwex | ✅ | ❌ Limité | ❌ | ❌ |
| Coût mensuel | 0-100€ | 500-2000€ | 200-1000€ | 100-500€ |
| Évolutif/customisable | ✅ Total | ❌ | ⚠ Limité | ❌ |
| Intégration Odoo native | ✅ Sur mesure | ⚠ Connecteur | ⚠ Connecteur | ❌ |
| Vendor lock-in | ❌ Aucun (code = propriété client) | ✅ Fort | ✅ Fort | ✅ Fort |
| Délai mise en prod | Aujourd'hui | 1-2 mois (formation) | 2-3 mois | 1 mois |
| Maintenance | Dev disponible | Editeur | Editeur | Editeur |
| Risque éditeur ferme | Faible (code chez client) | Possible | Possible | Possible |

### Notre argument vs SaaS booking
Avec un SaaS booking :
- Multiwex paie 200-1000€/mois pour des fonctionnalités génériques pas vraiment adaptées
- Toute customisation = surcoût ou impossible
- Données chez l'éditeur (lock-in)
- Si l'éditeur ferme → migration douloureuse, parfois impossible
- Branding minimaliste (logo + couleur, pas de vrai contrôle UX)

Avec notre webapp custom :
- Coût marginal (cloud)
- Branding 100% Multiwex (identité visuelle galactique respectée)
- Spécifique à leurs besoins (multi-salles K7/Slash, blocages, notes, etc.)
- Code = propriété client (livré sur leur GitHub)
- Évolutivité illimitée (toute nouvelle feature = un commit)

---

## 11. Roadmap pour passer en production

### Étape 1 — Domaine & DNS (à faire par le client)
- [ ] Donner accès DNS du domaine `multiwex.be` (registrar : OVH, Combell, Gandi…)
- [ ] Setup sous-domaine pour la webapp : ex `app.multiwex.be` ou `reservations.multiwex.be`
- [ ] Vérification domaine dans Resend (3 records DNS)

### Étape 2 — Vercel production
- [ ] Configurer le custom domain `app.multiwex.be` dans Vercel
- [ ] Vérifier toutes les env vars (RESEND_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL, CRON_SECRET)
- [ ] Activer Vercel Analytics (gratuit, conformité RGPD ok)

### Étape 3 — Supabase production
- [ ] Créer projet Supabase production séparé du staging actuel
- [ ] Run toutes les migrations SQL (`supabase/migrations/*.sql`)
- [ ] Activer RLS sur les tables sensibles (bookings, customers)
- [ ] Configurer les backups (Pro tier recommandé pour daily backups + 30 jours rétention)
- [ ] Inviter le client en read-only sur le dashboard Supabase

### Étape 4 — Email
- [ ] Vérifier domaine `multiwex.be` dans Resend
- [ ] Tester délivrabilité (envoi vers Gmail, Outlook, Yahoo)
- [ ] Configurer DMARC en mode reject
- [ ] Activer monitoring Resend (alertes bounces)

### Étape 5 — Intégration Odoo
- [ ] Décider : Scénario A, B ou C avec le client
- [ ] Obtenir credentials API Odoo (URL, DB, user, password)
- [ ] Développer le connecteur (2-3j pour scénario A)
- [ ] Tester en sandbox Odoo
- [ ] Mettre en place monitoring sync

### Étape 6 — Sécurité & monitoring
- [ ] Activer Sentry ou équivalent pour error tracking
- [ ] Configurer alertes uptime (UptimeRobot, gratuit)
- [ ] Audit sécu : penetration test léger (peut être fait par nous)
- [ ] DPA signés avec Supabase, Vercel, Resend

### Étape 7 — Formation client
- [ ] Session 1h : tour back-office staff (calendrier, on-site, settings)
- [ ] Session 30min : gestion des notes et blocages
- [ ] Session 30min : configuration mails et templates
- [ ] Documentation utilisateur PDF (à rédiger)

### Étape 8 — Go-live
- [ ] Communication interne Multiwex (formation équipe)
- [ ] Soft launch (premier weekend, monitoring serré)
- [ ] Post-mortem + ajustements
- [ ] Archivage de l'ancien système

---

## Annexes

### Glossaire

| Terme | Définition |
|---|---|
| **API** | Interface de programmation. Permet à deux logiciels de se parler |
| **Cron** | Tâche programmée qui s'exécute à intervalle régulier (ex: tous les jours à 10h) |
| **Cache CDN** | Réseau de serveurs qui stockent du contenu près des utilisateurs pour accélérer le chargement |
| **DKIM** | Signature cryptographique des mails pour prouver l'authenticité de l'expéditeur |
| **DMARC** | Politique qui dit aux serveurs mail quoi faire si SPF/DKIM échouent |
| **DNS** | Annuaire qui traduit `multiwex.be` en adresse IP |
| **DPA** | Data Processing Agreement, contrat RGPD entre vous et un sous-traitant |
| **HTTPS** | Protocole web sécurisé (chiffrement) |
| **JSON** | Format texte structuré pour échanger des données entre services |
| **PWA** | Progressive Web App — webapp installable comme une app mobile |
| **Realtime** | Technologie qui permet de pousser des updates instantanément aux clients connectés |
| **REST/XML-RPC** | Standards d'API (Odoo supporte les deux) |
| **RGPD** | Règlement général sur la protection des données (loi EU 2018) |
| **RLS** | Row Level Security — règles d'accès au niveau de la ligne en base de données |
| **SLA** | Service Level Agreement — engagement de disponibilité (ex: 99.9%) |
| **SMTP** | Protocole standard d'envoi de mail |
| **SPF** | Liste des serveurs autorisés à envoyer du mail pour un domaine |
| **SSR** | Server-Side Rendering — page générée côté serveur (vs SPA tout côté navigateur) |
| **Webhook** | Notification HTTP envoyée automatiquement quand un événement se produit |

### Liens utiles
- Supabase docs : https://supabase.com/docs
- Vercel docs : https://vercel.com/docs
- Resend docs : https://resend.com/docs
- Next.js docs : https://nextjs.org/docs
- Odoo XML-RPC API : https://www.odoo.com/documentation/master/developer/reference/external_api.html

### Contacts en cas de support
- **Vercel** : support@vercel.com (réactif)
- **Supabase** : Discord communautaire + ticket dashboard
- **Resend** : support@resend.com (très réactif)
