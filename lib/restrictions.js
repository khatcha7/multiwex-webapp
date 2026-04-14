// Restrictions par activité scrapées depuis multiwex.be le 14/04/2026

export const restrictions = {
  battlekart: {
    heightMin: 145,
    footwear: 'closed',
    physical: 'Les deux jambes doivent être fonctionnelles',
    disclaimerShort: 'Taille min 1,45m · chaussures fermées obligatoires',
    disclaimerLong: 'Pour piloter un BattleKart, il faut mesurer au minimum 1m45. Les chaussures fermées sont obligatoires (talons déconseillés). Les deux jambes doivent être fonctionnelles pour contrôler l\'accélération, le freinage et la direction.',
  },
  eyestart: {
    ageMin: 8,
    disclaimerShort: 'À partir de 8 ans',
    disclaimerLong: 'Le casque de réalité virtuelle doit rester bien en place sur la tête. Déconseillé aux enfants de moins de 8 ans.',
  },
  darkdrift: {
    heightMin: 145,
    footwear: 'closed',
    physical: 'Mobilité des deux bras et mains requise',
    disclaimerShort: 'Taille min 1,45m · chaussures fermées',
    disclaimerLong: 'Il faut mesurer au minimum 1m45 pour accéder en toute sécurité. Chaussures fermées obligatoires (talons déconseillés). Les trikes ne sont pas adaptés aux personnes ne disposant pas de la mobilité de leurs deux bras et mains.',
  },
  freedrift: {
    ageMinPassenger: 3,
    ageMinDriver: 16,
    heightMin: 145,
    footwear: 'closed',
    physical: 'Mobilité des deux bras et mains requise, bons réflexes psychomoteurs',
    disclaimerShort: '16 ans pour piloter · 1,45m min · chaussures fermées',
    disclaimerLong: 'Âge minimum 16 ans pour piloter, 3 ans en passager. Taille minimum 1m45 pour piloter en solo. Chaussures fermées obligatoires. Le personnel peut refuser l\'accès si le joueur n\'a pas le contrôle suffisant pour évoluer en toute sécurité.',
  },
  slashhit: {
    ageMin: 14,
    footwear: 'closed',
    adultAccompaniment: true,
    alcoholRestriction: true,
    disclaimerShort: 'À partir de 14 ans · chaussures fermées',
    disclaimerLong: 'À partir de 14 ans. Les mineurs doivent être accompagnés d\'un adulte pendant toute la session. Chaussures fermées obligatoires. Aucun cocktail ou alcool fort servi pendant la session pour des raisons de sécurité. Seules les haches fournies par l\'établissement peuvent être utilisées.',
  },
  cube3: {
    ageMin: 4,
    footwear: 'closed',
    adultAccompaniment: true,
    disclaimerShort: 'À partir de 4 ans · chaussures fermées',
    disclaimerLong: 'À partir de 4 ans. Les enfants doivent être accompagnés d\'au moins un adulte. Chaussures fermées obligatoires. Maximum 6 joueurs simultanément.',
  },
  buzzequiz: {
    ageMin: 8,
    adultAccompaniment: true,
    minPlayers: 4,
    stairsOnly: true,
    disclaimerShort: 'À partir de 8 ans · min 4 joueurs',
    disclaimerLong: 'À partir de 8 ans. Les enfants de moins de 16 ans doivent être accompagnés d\'un adulte. Minimum 4 personnes, maximum 12. L\'activité se situe à l\'étage (accès uniquement par escaliers).',
  },
  k7: {
    minPlayers: 4,
    ownDrinksForbidden: true,
    disclaimerShort: 'Min 4 personnes · boissons extérieures interdites',
    disclaimerLong: 'Minimum 4 personnes pour la privatisation de la salle. Pour les groupes plus petits, le tarif de 4 participants s\'applique. Il n\'est pas autorisé d\'apporter vos propres boissons ou nourriture. Un mini-bar est disponible dans chaque salle.',
  },
  starcadium: {
    disclaimerShort: 'Accès libre · tous âges',
    disclaimerLong: 'Espace arcade en accès libre, 300m². Pas de réservation nécessaire. Achat d\'une carte cashless à l\'accueil.',
  },
};

export function getRestrictions(activityId) {
  return restrictions[activityId] || null;
}
