export const activities = [
  {
    id: 'battlekart',
    name: 'BattleKart',
    tagline: 'Karting électrique augmenté',
    duration: 30,
    priceRegular: 0,
    priceWed: 0,
    maxPlayers: 10,
    image: '/images/activities/battlekart.jpg',
    description: "Karting électrique sur une piste augmentée en réalité mixte avec modes de jeu interactifs.",
    bookable: false,
    external: 'https://www.battlekart.com/fr/wex/booking',
  },
  {
    id: 'eyestart',
    name: 'EyeStart',
    tagline: 'VR Arena 100m²',
    duration: 20,
    priceRegular: 19,
    priceWed: 10,
    maxPlayers: 8,
    image: '/images/activities/eyestart.jpg',
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
    maxPlayers: 6,
    image: '/images/activities/darkdrift.jpg',
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
    maxPlayers: 4,
    image: '/images/activities/freedrift.jpg',
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
    maxPlayers: 18,
    image: '/images/activities/k7.jpg',
    description: "Salles privées de karaoké — 3 salles (Studio & Record 8 pers, Dancefloor 18 pers).",
    bookable: true,
  },
  {
    id: 'slashhit',
    name: 'Slash and Hit',
    tagline: 'Lancer de haches digital',
    duration: 60,
    priceRegular: 19,
    priceWed: 10,
    maxPlayers: 6,
    image: '/images/activities/slashhit.jpg',
    description: "Lancer de vraies haches sur cibles numériques interactives — nouvelle génération.",
    bookable: true,
  },
  {
    id: 'buzzequiz',
    name: 'Buzz-e-Quiz',
    tagline: 'Quiz interactif',
    duration: 60,
    priceRegular: 19,
    priceWed: 10,
    maxPlayers: 12,
    image: '/images/activities/buzzequiz.jpg',
    description: "Testez vos connaissances dans une multitude de domaines en mode compétition.",
    bookable: true,
  },
  {
    id: 'cube3',
    name: 'Cube3',
    tagline: 'Pixel floor',
    duration: 15,
    priceRegular: 10,
    priceWed: 5,
    maxPlayers: 6,
    image: '/images/activities/cube3.jpg',
    description: "Dalles lumineuses en salle obscure — niveaux pixelisés et scores à battre.",
    bookable: true,
  },
  {
    id: 'starcadium',
    name: 'Starcadium',
    tagline: 'Arcade 300m²',
    duration: 0,
    priceRegular: 0,
    priceWed: 0,
    maxPlayers: 100,
    image: '/images/activities/starcadium.jpg',
    description: "300m² de salle d'arcade — 20+ bornes, billard, baby-foot. Accès libre.",
    bookable: false,
    walkIn: true,
  },
];

export function getActivity(id) {
  return activities.find((a) => a.id === id);
}

export function isWednesdayDiscount(dateStr) {
  const d = new Date(dateStr);
  return d.getDay() === 3;
}

export function getActivityPrice(activity, dateStr) {
  if (!activity.bookable) return 0;
  return isWednesdayDiscount(dateStr) ? activity.priceWed : activity.priceRegular;
}
