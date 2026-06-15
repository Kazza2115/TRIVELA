// ─── Statistiques des grandes compétitions continentales ────────────────────
// Données historiques « highlights » par confédération, affichées quand on
// touche un continent (ou un pays vedette) sur le globe.
// Les codes drapeaux suivent flagcdn.com (ISO-2). Données indicatives — repères
// historiques largement établis (palmarès, buteurs, faits marquants).

export interface TitleHolder {
  code: string   // code drapeau flagcdn (ex. 'ar'); '' pour nation historique disparue
  name: string
  count: number
}

export interface FinalResult {
  year: number
  winner: string
  winnerCode: string
  score: string
  runnerUp: string
  runnerUpCode: string
}

export interface TopScorer {
  name: string
  country: string
  countryCode: string
  goals: number
}

export interface RecordItem {
  label: string
  value: string
}

export interface CompetitionData {
  conf: string
  competition: string     // « Copa América »
  region: string          // « Amérique du Sud »
  emoji: string
  color: string           // accent (hex)
  founded: number
  editions: string        // texte libre (ex. « 48 éditions »)
  tagline: string         // une phrase d'accroche
  titles: TitleHolder[]
  recentFinals: FinalResult[]
  topScorers?: TopScorer[]
  records: RecordItem[]
  facts: string[]
  nextEdition?: { year: number; host: string }
}

export const COMPETITIONS: Record<string, CompetitionData> = {
  // ─── Amérique du Sud ──────────────────────────────────────────────────────
  CONMEBOL: {
    conf: 'CONMEBOL',
    competition: 'Copa América',
    region: 'Amérique du Sud',
    emoji: '🌎',
    color: '#009B3A',
    founded: 1916,
    editions: 'Depuis 1916 · la plus ancienne',
    tagline: 'Le plus vieux tournoi continental du monde.',
    titles: [
      { code: 'ar', name: 'Argentine', count: 16 },
      { code: 'uy', name: 'Uruguay',   count: 15 },
      { code: 'br', name: 'Brésil',    count: 9  },
      { code: 'py', name: 'Paraguay',  count: 2  },
      { code: 'cl', name: 'Chili',     count: 2  },
      { code: 'pe', name: 'Pérou',     count: 2  },
      { code: 'co', name: 'Colombie',  count: 1  },
      { code: 'bo', name: 'Bolivie',   count: 1  },
    ],
    recentFinals: [
      { year: 2024, winner: 'Argentine', winnerCode: 'ar', score: '1–0',        runnerUp: 'Colombie', runnerUpCode: 'co' },
      { year: 2021, winner: 'Argentine', winnerCode: 'ar', score: '1–0',        runnerUp: 'Brésil',   runnerUpCode: 'br' },
      { year: 2019, winner: 'Brésil',    winnerCode: 'br', score: '3–1',        runnerUp: 'Pérou',    runnerUpCode: 'pe' },
      { year: 2016, winner: 'Chili',     winnerCode: 'cl', score: '0–0 (4-2 t.a.b.)', runnerUp: 'Argentine', runnerUpCode: 'ar' },
    ],
    topScorers: [
      { name: 'Norberto Méndez',   country: 'Argentine', countryCode: 'ar', goals: 17 },
      { name: 'Zizinho',           country: 'Brésil',    countryCode: 'br', goals: 17 },
      { name: 'Teodoro Fernández', country: 'Pérou',     countryCode: 'pe', goals: 15 },
      { name: 'Lionel Messi',      country: 'Argentine', countryCode: 'ar', goals: 14 },
    ],
    records: [
      { label: 'Plus titrée',      value: 'Argentine — 16 titres' },
      { label: '1ère édition',     value: '1916, remportée par l’Uruguay' },
      { label: 'Sacre de Messi',   value: '2021, son 1er grand titre' },
    ],
    facts: [
      'Créée en 1916, c’est la plus ancienne compétition de sélections au monde.',
      'Argentine et Uruguay accaparent à elles seules plus de la moitié des titres.',
      'En 2019, le Brésil a soulevé le trophée à domicile face au Pérou.',
      'En 2021, Lionel Messi décroche enfin un trophée majeur avec l’Argentine.',
    ],
    nextEdition: { year: 2028, host: 'Hôte à définir' },
  },

  // ─── Europe ───────────────────────────────────────────────────────────────
  UEFA: {
    conf: 'UEFA',
    competition: 'Championnat d’Europe',
    region: 'Europe',
    emoji: '🇪🇺',
    color: '#C60B1E',
    founded: 1960,
    editions: 'Depuis 1960',
    tagline: 'L’« Euro » — le sommet du football européen.',
    titles: [
      { code: 'es', name: 'Espagne',        count: 4 },
      { code: 'de', name: 'Allemagne',      count: 3 },
      { code: 'it', name: 'Italie',         count: 2 },
      { code: 'fr', name: 'France',         count: 2 },
      { code: '',   name: 'URSS',           count: 1 },
      { code: 'cz', name: 'Tchécoslovaquie', count: 1 },
      { code: 'nl', name: 'Pays-Bas',       count: 1 },
      { code: 'dk', name: 'Danemark',       count: 1 },
      { code: 'gr', name: 'Grèce',          count: 1 },
      { code: 'pt', name: 'Portugal',       count: 1 },
    ],
    recentFinals: [
      { year: 2024, winner: 'Espagne',  winnerCode: 'es', score: '2–1',              runnerUp: 'Angleterre', runnerUpCode: 'gb-eng' },
      { year: 2020, winner: 'Italie',   winnerCode: 'it', score: '1–1 (3-2 t.a.b.)', runnerUp: 'Angleterre', runnerUpCode: 'gb-eng' },
      { year: 2016, winner: 'Portugal', winnerCode: 'pt', score: '1–0 (a.p.)',       runnerUp: 'France',     runnerUpCode: 'fr' },
      { year: 2012, winner: 'Espagne',  winnerCode: 'es', score: '4–0',              runnerUp: 'Italie',     runnerUpCode: 'it' },
    ],
    topScorers: [
      { name: 'Cristiano Ronaldo', country: 'Portugal', countryCode: 'pt', goals: 14 },
      { name: 'Michel Platini',    country: 'France',   countryCode: 'fr', goals: 9  },
      { name: 'Alan Shearer',      country: 'Angleterre', countryCode: 'gb-eng', goals: 7 },
      { name: 'Antoine Griezmann', country: 'France',   countryCode: 'fr', goals: 7  },
    ],
    records: [
      { label: 'Plus titrée',        value: 'Espagne — 4 titres' },
      { label: 'Meilleur buteur',    value: 'Cristiano Ronaldo — 14 buts' },
      { label: 'Exploit individuel', value: 'Platini, 9 buts en une seule édition (1984)' },
    ],
    facts: [
      'En 1984, Michel Platini inscrit 9 buts en un seul tournoi — record toujours debout.',
      'La Grèce crée la sensation en remportant l’Euro 2004 contre toute attente.',
      'Cristiano Ronaldo est à la fois recordman de buts et de sélections de l’épreuve.',
      'L’Espagne (2008 + 2012) est la 1ère à conserver son titre, et la plus titrée depuis 2024.',
    ],
    nextEdition: { year: 2028, host: 'Royaume-Uni & Irlande' },
  },

  // ─── Amérique du Nord / Centrale / Caraïbes ───────────────────────────────
  CONCACAF: {
    conf: 'CONCACAF',
    competition: 'Gold Cup',
    region: 'Amérique du Nord',
    emoji: '🌎',
    color: '#3C3B6E',
    founded: 1991,
    editions: 'Depuis 1991',
    tagline: 'Le duel éternel entre le Mexique et les États-Unis.',
    titles: [
      { code: 'mx', name: 'Mexique',    count: 10 },
      { code: 'us', name: 'États-Unis', count: 7 },
      { code: 'ca', name: 'Canada',     count: 1 },
    ],
    recentFinals: [
      { year: 2025, winner: 'Mexique',     winnerCode: 'mx', score: '2–1',        runnerUp: 'États-Unis',  runnerUpCode: 'us' },
      { year: 2023, winner: 'Mexique',     winnerCode: 'mx', score: '1–0',        runnerUp: 'Panama',      runnerUpCode: 'pa' },
      { year: 2021, winner: 'États-Unis',  winnerCode: 'us', score: '1–0 (a.p.)', runnerUp: 'Mexique',     runnerUpCode: 'mx' },
      { year: 2019, winner: 'Mexique',     winnerCode: 'mx', score: '1–0',        runnerUp: 'États-Unis',  runnerUpCode: 'us' },
    ],
    topScorers: [
      { name: 'Landon Donovan', country: 'États-Unis', countryCode: 'us', goals: 18 },
      { name: 'Clint Dempsey',  country: 'États-Unis', countryCode: 'us', goals: 13 },
      { name: 'Zague',          country: 'Mexique',    countryCode: 'mx', goals: 12 },
    ],
    records: [
      { label: 'Plus titrée',     value: 'Mexique — 10 titres' },
      { label: 'Meilleur buteur', value: 'Landon Donovan — 18 buts' },
    ],
    facts: [
      'En 2025, le Mexique bat les États-Unis 2–1 en finale et décroche un 10e titre record.',
      'Le Mexique et les États-Unis se partagent presque tous les titres de l’épreuve.',
      'La Jamaïque a atteint deux finales, performance rare hors du duo de tête.',
      'Landon Donovan reste le meilleur buteur de l’histoire de la compétition.',
    ],
    nextEdition: { year: 2027, host: 'À définir' },
  },

  // ─── Afrique ──────────────────────────────────────────────────────────────
  CAF: {
    conf: 'CAF',
    competition: 'Coupe d’Afrique des Nations',
    region: 'Afrique',
    emoji: '🌍',
    color: '#E0A100',
    founded: 1957,
    editions: 'Depuis 1957',
    tagline: 'La CAN — ferveur et imprévisibilité.',
    titles: [
      { code: 'eg', name: 'Égypte',        count: 7 },
      { code: 'cm', name: 'Cameroun',      count: 5 },
      { code: 'gh', name: 'Ghana',         count: 4 },
      { code: 'ng', name: 'Nigeria',       count: 3 },
      { code: 'ci', name: 'Côte d’Ivoire', count: 3 },
      { code: 'dz', name: 'Algérie',       count: 2 },
      { code: 'cd', name: 'RD Congo',      count: 2 },
      { code: 'ma', name: 'Maroc',         count: 1 },
      { code: 'za', name: 'Afrique du Sud', count: 1 },
      { code: 'zm', name: 'Zambie',        count: 1 },
      { code: 'tn', name: 'Tunisie',       count: 1 },
      { code: 'sd', name: 'Soudan',        count: 1 },
      { code: 'et', name: 'Éthiopie',      count: 1 },
      { code: 'cg', name: 'Congo',         count: 1 },
      { code: 'sn', name: 'Sénégal',       count: 1 },
    ],
    recentFinals: [
      { year: 2023, winner: 'Côte d’Ivoire', winnerCode: 'ci', score: '2–1',              runnerUp: 'Nigeria', runnerUpCode: 'ng' },
      { year: 2021, winner: 'Sénégal',       winnerCode: 'sn', score: '0–0 (4-2 t.a.b.)', runnerUp: 'Égypte',  runnerUpCode: 'eg' },
      { year: 2019, winner: 'Algérie',       winnerCode: 'dz', score: '1–0',              runnerUp: 'Sénégal', runnerUpCode: 'sn' },
      { year: 2017, winner: 'Cameroun',      winnerCode: 'cm', score: '2–1',              runnerUp: 'Égypte',  runnerUpCode: 'eg' },
    ],
    topScorers: [
      { name: 'Samuel Eto’o',   country: 'Cameroun',      countryCode: 'cm', goals: 18 },
      { name: 'Laurent Pokou',  country: 'Côte d’Ivoire', countryCode: 'ci', goals: 14 },
      { name: 'Rashidi Yekini', country: 'Nigeria',       countryCode: 'ng', goals: 13 },
    ],
    records: [
      { label: 'Plus titrée',     value: 'Égypte — 7 titres' },
      { label: 'Meilleur buteur', value: 'Samuel Eto’o — 18 buts' },
    ],
    facts: [
      'L’Égypte détient le record avec 7 titres continentaux.',
      'Samuel Eto’o est le meilleur buteur de l’histoire de la CAN.',
      'En 2021, le Sénégal décroche son tout premier titre face à l’Égypte.',
      'En 2023, la Côte d’Ivoire est sacrée championne à domicile après un parcours improbable.',
    ],
    nextEdition: { year: 2027, host: 'Kenya · Tanzanie · Ouganda' },
  },

  // ─── Asie ─────────────────────────────────────────────────────────────────
  AFC: {
    conf: 'AFC',
    competition: 'Coupe d’Asie',
    region: 'Asie',
    emoji: '🌏',
    color: '#F07D0F',
    founded: 1956,
    editions: 'Depuis 1956',
    tagline: 'Le sommet du football asiatique.',
    titles: [
      { code: 'jp', name: 'Japon',           count: 4 },
      { code: 'sa', name: 'Arabie saoudite', count: 3 },
      { code: 'ir', name: 'Iran',            count: 3 },
      { code: 'kr', name: 'Corée du Sud',    count: 2 },
      { code: 'qa', name: 'Qatar',           count: 2 },
      { code: 'il', name: 'Israël',          count: 1 },
      { code: 'kw', name: 'Koweït',          count: 1 },
      { code: 'iq', name: 'Irak',            count: 1 },
      { code: 'au', name: 'Australie',       count: 1 },
    ],
    recentFinals: [
      { year: 2023, winner: 'Qatar',     winnerCode: 'qa', score: '3–1',        runnerUp: 'Jordanie',     runnerUpCode: 'jo' },
      { year: 2019, winner: 'Qatar',     winnerCode: 'qa', score: '3–1',        runnerUp: 'Japon',        runnerUpCode: 'jp' },
      { year: 2015, winner: 'Australie', winnerCode: 'au', score: '2–1 (a.p.)', runnerUp: 'Corée du Sud', runnerUpCode: 'kr' },
      { year: 2011, winner: 'Japon',     winnerCode: 'jp', score: '1–0 (a.p.)', runnerUp: 'Australie',    runnerUpCode: 'au' },
    ],
    topScorers: [
      { name: 'Ali Daei',       country: 'Iran',        countryCode: 'ir', goals: 14 },
      { name: 'Lee Dong-gook',  country: 'Corée du Sud', countryCode: 'kr', goals: 10 },
      { name: 'Naohiro Takahara', country: 'Japon',     countryCode: 'jp', goals: 9 },
    ],
    records: [
      { label: 'Plus titré',      value: 'Japon — 4 titres' },
      { label: 'Meilleur buteur', value: 'Ali Daei — 14 buts' },
    ],
    facts: [
      'Le Japon est la nation la plus titrée avec 4 couronnes.',
      'Le Qatar a réussi le doublé en 2019 puis 2023.',
      'Entrée à l’AFC en 2006, l’Australie remporte le titre dès 2015.',
      'En 2007, l’Irak crée la sensation en s’imposant en pleine guerre civile.',
    ],
    nextEdition: { year: 2027, host: 'Arabie saoudite' },
  },

  // ─── Océanie ──────────────────────────────────────────────────────────────
  OFC: {
    conf: 'OFC',
    competition: 'Coupe des Nations OFC',
    region: 'Océanie',
    emoji: '🌏',
    color: '#06B6D4',
    founded: 1973,
    editions: 'Depuis 1973',
    tagline: 'Le royaume de la Nouvelle-Zélande.',
    titles: [
      { code: 'nz', name: 'Nouvelle-Zélande', count: 6 },
      { code: 'au', name: 'Australie',        count: 4 },
      { code: 'pf', name: 'Tahiti',           count: 1 },
    ],
    recentFinals: [
      { year: 2024, winner: 'Nouvelle-Zélande', winnerCode: 'nz', score: '3–0',              runnerUp: 'Vanuatu',           runnerUpCode: 'vu' },
      { year: 2016, winner: 'Nouvelle-Zélande', winnerCode: 'nz', score: '0–0 (4-2 t.a.b.)', runnerUp: 'Papouasie-N.-Guinée', runnerUpCode: 'pg' },
      { year: 2012, winner: 'Tahiti',           winnerCode: 'pf', score: '1–0',              runnerUp: 'Nouvelle-Calédonie', runnerUpCode: 'nc' },
    ],
    records: [
      { label: 'Plus titrée',      value: 'Nouvelle-Zélande — nation reine' },
      { label: 'Vainqueur surprise', value: 'Tahiti — 2012' },
    ],
    facts: [
      'La Nouvelle-Zélande domine outrageusement la compétition.',
      'En 2012, Tahiti crée l’exploit et disputera la Coupe des Confédérations 2013.',
      'L’Australie a quitté l’OFC pour l’AFC en 2006, rebattant les cartes de la zone.',
      'Le vainqueur de l’OFC passe par un barrage intercontinental pour le Mondial.',
    ],
    nextEdition: { year: 2028, host: 'À définir' },
  },
}
