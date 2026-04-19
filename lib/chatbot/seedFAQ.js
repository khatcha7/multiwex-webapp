// Seed FAQ pré-rempli depuis les données existantes (activities, hours, contact).
// Appelé une fois lors du premier chargement du chatbot si la table chat_faq est vide.

import { activities } from '@/lib/activities';

export function buildSeedFAQ(config = {}) {
  const faqs = [];
  let pos = 0;

  const phone = config['contact.phone'] || '+32 (0)84 770 222';
  const email = config['contact.email'] || 'info@multiwex.be';
  const address = `${config['company.address_street'] || 'Rue des Deux Provinces 1'}, ${config['company.address_zip'] || '6900'} ${config['company.address_city'] || 'Marche-en-Famenne'}`;

  // === Horaires & accès ===
  faqs.push({
    question: "Quels sont vos horaires d'ouverture ?",
    keywords: ['horaires', 'ouverture', 'ouvert', 'fermé', 'heure', 'samedi', 'dimanche', 'semaine'],
    answer: `Le samedi nous sommes ouverts de **10h à 23h**. Pour les autres jours, consultez notre site officiel ou appelez-nous au ${phone}.`,
    category: 'horaires',
    position: pos++,
  });

  faqs.push({
    question: "Où êtes-vous situés ?",
    keywords: ['adresse', 'situé', 'localisation', 'ou', 'où', 'comment venir', 'maps', 'parking'],
    answer: `Nous sommes au **${address}**, dans la zone WEX à Marche-en-Famenne (Belgique).\n\n🅿️ **3000 places de parking gratuites** + 8 bornes de recharge électrique (app SMAPPEE).\n\n[Itinéraire Google Maps](${config['company.maps_url'] || 'https://maps.google.com'})`,
    category: 'acces',
    position: pos++,
  });

  // === Réservation ===
  faqs.push({
    question: "Comment réserver ?",
    keywords: ['réserver', 'reservation', 'reserver', 'comment booker', 'booking'],
    answer: `Vous pouvez réserver directement en ligne via notre [page de réservation](/booking). Choisissez votre activité, votre créneau, le nombre de joueurs et procédez au paiement. Vous recevrez immédiatement un email de confirmation avec votre facture.`,
    category: 'reservation',
    position: pos++,
  });

  faqs.push({
    question: "Puis-je modifier ou annuler ma réservation ?",
    keywords: ['modifier', 'annuler', 'changer', 'annulation', 'remboursement'],
    answer: `Vous pouvez modifier ou annuler votre réservation jusqu'à **24h avant** votre créneau depuis votre [compte client](/account). Au-delà, contactez-nous au ${phone}.`,
    category: 'reservation',
    position: pos++,
  });

  faqs.push({
    question: "Comment ajouter des joueurs à une réservation existante ?",
    keywords: ['ajouter', 'joueur', 'rajouter', 'plus de monde', 'augmenter'],
    answer: `Connectez-vous à votre [compte client](/account), ouvrez votre réservation et cliquez sur **"+ Ajouter joueurs"**. Le supplément est calculé automatiquement et payable en ligne.`,
    category: 'reservation',
    position: pos++,
  });

  // === Tarifs ===
  faqs.push({
    question: "Quels sont vos tarifs ?",
    keywords: ['tarif', 'prix', 'coût', 'combien', 'tarifs'],
    answer: `Voici nos tarifs principaux (par personne) :\n\n${activities.filter((a) => a.bookable && a.priceRegular > 0).map((a) => `• **${a.name}** : ${a.priceRegular}€ (${a.duration} min) — ~${a.priceWed}€ le mercredi`).join('\n')}\n\n💡 **Mercredi : -50% sur toutes les activités !**\n\nDétails sur notre [page tarifs](https://www.multiwex.be/fr/tarif).`,
    category: 'tarifs',
    position: pos++,
  });

  faqs.push({
    question: "Y a-t-il des promotions ou des réductions ?",
    keywords: ['promo', 'promotion', 'réduction', 'discount', 'soldes', 'mercredi', 'flash'],
    answer: `Oui ! Nous proposons :\n• **Mercredi -50%** sur toutes les activités\n• Des **offres flash** ponctuelles (-20%, -30% selon période)\n• Des **forfaits anniversaires** et **packs entreprises**\n\nSuivez-nous sur [Instagram](${config['social.instagram'] || '#'}) pour ne rien rater.`,
    category: 'tarifs',
    position: pos++,
  });

  // === Carte cadeau ===
  faqs.push({
    question: "Puis-je commander une carte cadeau ?",
    keywords: ['cadeau', 'gift', 'carte cadeau', 'voucher', 'offrir'],
    answer: `Bien sûr ! Achetez votre carte cadeau directement [ici](/giftcard) — montants au choix (20€, 50€, 100€ ou personnalisé). La carte est envoyée par email au bénéficiaire avec un voucher PDF.`,
    category: 'cartecadeau',
    position: pos++,
  });

  // === Activités (1 FAQ par activité bookable) ===
  activities.filter((a) => a.bookable && a.description).forEach((a) => {
    const cap = a.minPlayers === a.maxPlayers ? `${a.maxPlayers} joueurs` : `${a.minPlayers}-${a.maxPlayers} joueurs`;
    const rooms = a.rooms ? `\n\n**Salles disponibles** :\n${a.rooms.map((r) => `• ${r.name} (${r.minPlayers}-${r.maxPlayers} pers.)`).join('\n')}` : '';
    const privative = a.privative ? '\n\n⚠️ **Activité privative** : 1 seul groupe par créneau.' : '';
    faqs.push({
      question: `C'est quoi ${a.name} ?`,
      keywords: [a.name.toLowerCase(), a.id, ...(a.tagline?.toLowerCase().split(' ') || [])],
      answer: `**${a.name}** — ${a.tagline}\n\n${a.description}\n\n• **Durée** : ${a.duration} min\n• **Capacité** : ${cap}\n• **Tarif** : ${a.priceRegular}€/pers (${a.priceWed}€ le mercredi)${rooms}${privative}`,
      category: 'activites',
      position: pos++,
    });
  });

  // === FAQ générales ===
  faqs.push({
    question: "Y a-t-il un âge minimum ?",
    keywords: ['age', 'âge', 'enfant', 'minimum', 'mineur', 'minimum age'],
    answer: `Cela dépend de l'activité. La plupart sont accessibles dès **8 ans accompagné** d'un adulte. Pour DarkDrift et BattleKart, l'âge minimum est de **14 ans**. Contactez-nous au ${phone} pour confirmer selon l'activité visée.`,
    category: 'pratique',
    position: pos++,
  });

  faqs.push({
    question: "Avez-vous une brasserie / restaurant ?",
    keywords: ['manger', 'restaurant', 'brasserie', 'red planet', 'boisson', 'nourriture', 'snack'],
    answer: `Oui ! La **Red Planet Brasserie** sur place vous propose plats, snacks, boissons et cocktails. Idéale entre deux activités ou pour un événement complet. [En savoir plus](https://www.multiwex.be/fr/brasserie).`,
    category: 'brasserie',
    position: pos++,
  });

  faqs.push({
    question: "Organisez-vous des anniversaires / événements d'entreprise ?",
    keywords: ['anniversaire', 'enterrement', 'evjf', 'evg', 'entreprise', 'team building', 'groupe', 'événement', 'evenement'],
    answer: `Absolument ! Nous proposons des **forfaits sur mesure** pour anniversaires, EVJF/EVG, team buildings et événements d'entreprise. Contactez-nous au ${phone} ou par email à ${email} pour un devis personnalisé.`,
    category: 'evenements',
    position: pos++,
  });

  faqs.push({
    question: "Comment vous contacter ?",
    keywords: ['contact', 'contacter', 'téléphone', 'email', 'mail', 'numéro', 'appeler'],
    answer: `📞 **Téléphone** : ${phone}\n📧 **Email** : ${email}\n📍 **Adresse** : ${address}\n\nVous pouvez aussi nous contacter via [Instagram](${config['social.instagram'] || '#'}) ou [Facebook](${config['social.facebook'] || '#'}).`,
    category: 'contact',
    position: pos++,
  });

  faqs.push({
    question: "Y a-t-il un parking ?",
    keywords: ['parking', 'voiture', 'stationnement', 'gratuit'],
    answer: `Oui ! **3000 places de parking gratuites** sur le site WEX, dont des places PMR. Nous avons aussi **8 bornes de recharge électrique** (via app SMAPPEE).`,
    category: 'pratique',
    position: pos++,
  });

  faqs.push({
    question: "Quelle tenue dois-je porter ?",
    keywords: ['tenue', 'vetement', 'vêtement', 'porter', 'chaussure', 'habillé'],
    answer: `Pour la plupart des activités : tenue **confortable** + **chaussures fermées** obligatoires (BattleKart, DarkDrift, FreeDrift, Slash and Hit). Pour K7, EyeStart et le quiz : tenue libre.`,
    category: 'pratique',
    position: pos++,
  });

  return faqs;
}
