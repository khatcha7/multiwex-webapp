// Données activités scrapées sur multiwex.be/fr/tarif le 14-15/04/2026
// minPlayers = min joueurs facturables (en dessous, on bloque ou on facture au min)
// maxPlayers = max joueurs par créneau
// privative = 1 groupe unique par créneau (pas de join)

export const activities = [
  {
    id: 'battlekart',
    name: 'BattleKart',
    tagline: 'Karting électrique augmenté',
    duration: 15,
    priceRegular: 19,
    priceWed: 10,
    minPlayers: 1,
    maxPlayers: 12,
    image: '/images/activities/battlekart.jpg',
    logo: '/images/brand/logo-battle-kart.svg',
    description: "Karting électrique sur piste augmentée avec modes de jeu interactifs.",
    bookable: false,
    selectable: true,
    external: 'https://www.battlekart.com/fr/wex/booking',
  },
  {
    id: 'eyestart',
    name: 'EyeStart',
    tagline: 'VR Arena 100m²',
    duration: 20,
    priceRegular: 19,
    priceWed: 10,
    minPlayers: 1,
    maxPlayers: 8,
    image: '/images/activities/eyestart.jpg',
    logo: '/images/brand/logo-eye-start.svg',
    description: "Casques VR et arène de 100m² — duels, zombies, énigmes rythmées et puzzles.",
    bookable: true,
  },
  {
    id: 'darkdrift',
    name: 'DarkDrift',
    tagline: 'Drift trike indoor',
    duration: 10,
    priceRegular: 10,
    priceWed: 5,
    minPlayers: 1,
    maxPlayers: 6,
    image: '/images/activities/darkdrift.jpg',
    logo: '/images/brand/logo-dark-drift.svg',
    description: "Trikes électriques sur circuit indoor. Glisse pure et adrénaline dans les virages.",
    bookable: true,
  },
  {
    id: 'freedrift',
    name: 'FreeDrift',
    tagline: 'Drift trike libre',
    duration: 8,
    priceRegular: 8,
    priceWed: 4,
    minPlayers: 1,
    maxPlayers: 4,
    image: '/images/activities/freedrift.jpg',
    logo: '/images/brand/logo-freedrift.svg',
    description: "Trikes électriques libres pour les amateurs de glisse — frisson garanti.",
    bookable: true,
  },
  {
    id: 'k7',
    name: 'K7 Karaoké',
    tagline: 'Salles privées 2h',
    duration: 120,
    priceRegular: 15,
    priceWed: 7.5,
    minPlayers: 4,
    maxPlayers: 18,
    image: '/images/activities/k7.jpg',
    logo: '/images/brand/logo-k7.svg',
    description: "Salles privées de karaoké — 3 salles (Record & Studio 4-12 pers, Dancefloor 8-18 pers).",
    bookable: true,
    privative: true,
    bufferMin: 30,
    rooms: [
      { id: 'k7-record', name: 'Record', minPlayers: 4, maxPlayers: 12 },
      { id: 'k7-studio', name: 'Studio', minPlayers: 4, maxPlayers: 12 },
      { id: 'k7-dancefloor', name: 'Dancefloor', minPlayers: 8, maxPlayers: 18 },
    ],
  },
  {
    id: 'slashhit',
    name: 'Slash and Hit',
    tagline: 'Lancer de haches digital',
    duration: 60,
    priceRegular: 19,
    priceWed: 10,
    minPlayers: 2,
    maxPlayers: 6,
    image: '/images/activities/slashhit.jpg',
    logo: '/images/brand/logo-slashhit.svg',
    description: "Lancer de vraies haches sur cibles numériques interactives — nouvelle génération.",
    bookable: true,
    privative: true,
    rooms: [
      { id: 'slash-piste1', name: 'Piste 1', minPlayers: 2, maxPlayers: 6 },
      { id: 'slash-piste2', name: 'Piste 2', minPlayers: 2, maxPlayers: 6 },
      { id: 'slash-piste3', name: 'Piste 3', minPlayers: 2, maxPlayers: 6 },
    ],
  },
  {
    id: 'buzzequiz',
    name: 'Buzz-e-Quiz',
    tagline: 'Quiz interactif',
    duration: 60,
    priceRegular: 19,
    priceWed: 10,
    minPlayers: 4,
    maxPlayers: 12,
    image: '/images/activities/buzzequiz.jpg',
    logo: '/images/brand/logo-buzz-quiz.svg',
    description: "Testez vos connaissances dans une multitude de domaines en mode compétition.",
    bookable: true,
    privative: true,
  },
  {
    id: 'cube3',
    name: 'Cube3',
    tagline: 'Pixel floor',
    duration: 15,
    priceRegular: 10,
    priceWed: 5,
    minPlayers: 1,
    maxPlayers: 6,
    image: '/images/activities/cube3.jpg',
    logo: '/images/brand/logo-cube-3.svg',
    description: "Dalles lumineuses en salle obscure — niveaux pixelisés et scores à battre.",
    bookable: true,
    privative: true,
  },
  {
    id: 'starcadium',
    name: 'Starcadium',
    tagline: 'Arcade 300m²',
    duration: 0,
    priceRegular: 0,
    priceWed: 0,
    minPlayers: 1,
    maxPlayers: 100,
    image: '/images/activities/starcadium.jpg',
    logo: '/images/brand/logo-starcadium.svg',
    description: "300m² de salle d'arcade — 20+ bornes, billard, baby-foot. Accès libre.",
    bookable: false,
    walkIn: true,
  },
];

export function getActivity(id) {
  return activities.find((a) => a.id === id);
}

export function isWednesdayDiscount(dateStr) {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay() === 3;
}

export function getActivityPrice(activity, dateStr) {
  if (!activity || !activity.bookable) return 0;
  return isWednesdayDiscount(dateStr) ? activity.priceWed : activity.priceRegular;
}

// Attribue automatiquement la salle K7 la mieux adaptée
// en fonction du nombre de joueurs et de la disponibilité des autres salles déjà prises
export function autoPickK7Room(playerCount, occupiedRoomIds = []) {
  const k7 = getActivity('k7');
  const rooms = (k7?.rooms || []).filter((r) => !occupiedRoomIds.includes(r.id));
  // Privilégier la salle la plus petite qui accueille le groupe
  const eligible = rooms.filter((r) => r.maxPlayers >= playerCount);
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => a.maxPlayers - b.maxPlayers);
  return eligible[0];
}
