import { describe, it, expect, beforeAll } from 'vitest';

// Filet de régression du lot L0, famille « fermée par L1 ».
//
// Chaque test reproduit un défaut constaté sur ce dépôt et vérifié dans les sources.
// Ils échouent volontairement tant que L1 n'a pas livré : leur passage au vert est le
// critère d'acceptation du lot. Les cas dont la correction relève du contrat numérique
// vivent dans regression-precision.test.js, sous it.fails, parce qu'ils resteront
// ouverts plus longtemps.

let creerServicePortefeuille;
let creerServiceCours;
let consolider;
let creerAdaptateurActions;

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://utilisateur:secret@localhost:5432/capitall';
  process.env.JWT_SECRET = 'e'.repeat(32);
  ({ creerServicePortefeuille } = await import('../portefeuilleConsolide.js'));
  ({ creerServiceCours } = await import('../cours.js'));
  ({ consolider } = await import('../calculPortefeuille.js'));
  ({ creerAdaptateurActions } = await import('../../adaptateurs/actions.js'));
});

// ---------------------------------------------------------------------------
// S-01 — un capital partiellement valorisé ne vaut pas un capital
// ---------------------------------------------------------------------------
//
// D56 pose qu'une alerte dont la valeur observée est indisponible n'est pas évaluée.
// evaluationAlertes applique correctement la règle, mais le service lui transmet
// toujours un capital non nul, fût-il incomplet : la garde ne peut jamais jouer pour la
// cible capital_total. Le snapshot du jour subit le même sort, et l'unicité
// (utilisateur_id, date_snapshot) le fige alors pour la journée entière.

function environnementPartiel({ positionSoldee = false } = {}) {
  const ecritures = [];

  // L'actif 2 n'a pas de cours. Selon le cas, il est encore détenu — le capital est
  // alors incomplet — ou soldé par une vente, auquel cas son cours manquant ne retire
  // rien au total. Une quantité de transaction nulle serait refusée par la base
  // (CHECK quantite > 0) : la position se solde par une vente, comme dans la réalité.
  const mouvementsActif2 = [
    {
      id: 2,
      actif_id: 2,
      sens: 'achat',
      quantite: '1',
      prix_unitaire: '900.00',
      frais: '0',
      date_transaction: '2026-01-01T12:00:00Z',
    },
  ];

  if (positionSoldee) {
    mouvementsActif2.push({
      id: 3,
      actif_id: 2,
      sens: 'vente',
      quantite: '1',
      prix_unitaire: '950.00',
      frais: '0',
      date_transaction: '2026-02-01T12:00:00Z',
    });
  }

  const service = creerServicePortefeuille({
    actifs: {
      listerParUtilisateur: async () => [
        { id: 1, type: 'action', symbole: 'AAPL', nom: 'Cours disponible' },
        { id: 2, type: 'crypto', symbole: 'BTC', nom: 'Cours indisponible' },
      ],
    },
    transactions: {
      listerParUtilisateur: async () => [
        {
          id: 1,
          actif_id: 1,
          sens: 'achat',
          quantite: '1',
          prix_unitaire: '100.00',
          frais: '0',
          date_transaction: '2026-01-01T12:00:00Z',
        },
        ...mouvementsActif2,
      ],
    },
    serviceCours: {
      getCoursMultiples: async () => [
        { symbole: 'AAPL', cours_eur: '100' },
        { symbole: 'BTC', erreur: 'Panne de cours' },
      ],
      getCours: async () => ({ cours_eur: '0.9' }),
    },
    snapshots: {
      enregistrerSiAbsent: async (utilisateurId, valeur) =>
        ecritures.push({ nature: 'valorisation', valeur }),
    },
    snapshotsCours: {
      enregistrerSiAbsent: async (utilisateurId, positions) =>
        ecritures.push({ nature: 'cours', symboles: positions.map((p) => p.symbole) }),
      listerRecentsParUtilisateur: async () => [],
    },
    alertes: {
      listerActivesParUtilisateur: async () => [
        {
          id: 8,
          type_cible: 'capital_total',
          sens_seuil: 'en_dessous',
          valeur_seuil: '500',
          statut: 'active',
        },
      ],
      marquerDeclenchees: async (utilisateurId, ids) =>
        ecritures.push({ nature: 'alertes', ids }),
    },
  });

  return { service, ecritures };
}

describe('S-01 qualité du capital consolidé', () => {
  it("ne déclenche pas une alerte de capital quand une position détenue n'a pas de cours", async () => {
    const { service } = environnementPartiel();

    const portefeuille = await service.actualiserPortefeuille(42);

    // 100 € sur deux positions détenues : le total n'est pas le capital, il en est une
    // part. Le comparer à un seuil revient à décider sur une valeur inconnue.
    expect(portefeuille.cours_indisponibles).toContain('BTC');
    expect(portefeuille.alertes_declenchees).toEqual([]);
  });

  it("n'enregistre pas le total du jour quand il est incomplet", async () => {
    const { service, ecritures } = environnementPartiel();

    await service.actualiserPortefeuille(42);

    expect(ecritures.filter((e) => e.nature === 'valorisation')).toEqual([]);
  });

  it("continue d'historiser les positions dont le cours est exploitable", async () => {
    const { service, ecritures } = environnementPartiel();

    await service.actualiserPortefeuille(42);

    // Le trou porte sur le total, pas sur les séries individuelles : renoncer aux deux
    // perdrait un historique que rien ne permet de reconstituer après coup.
    const historiqueCours = ecritures.find((e) => e.nature === 'cours');
    expect(historiqueCours?.symboles).toContain('AAPL');
  });

  it('ne dégrade pas le total pour une position sans quantité détenue', async () => {
    // Un cours manquant sur une position soldée ne retire rien : sa contribution est
    // nulle quel que soit le cours. La traiter comme une lacune priverait
    // l'utilisateur de son capital pour une ligne qui ne vaut rien.
    const { service } = environnementPartiel({ positionSoldee: true });

    const portefeuille = await service.actualiserPortefeuille(42);

    expect(portefeuille.alertes_declenchees).toHaveLength(1);
  });

  it('signale à l\'écran Seuils que le capital observé est incomplet', async () => {
    const { service } = environnementPartiel();

    const observees = await service.obtenirValeursObservees(42);

    // Le sous-total reste affichable, mais il doit être qualifié : sans ce drapeau,
    // l'écran Seuils présente une part du patrimoine comme s'il était complet.
    expect(observees.capitalComplet).toBe(false);
  });

  it("n'annonce aucun écart avant franchissement sur un capital incomplet", async () => {
    const { creerServiceAlerte } = await import('../alerte.js');

    const service = creerServiceAlerte({
      alertes: {
        listerParUtilisateur: async () => [
          {
            id: 8,
            type_cible: 'capital_total',
            actif_id: null,
            sens_seuil: 'en_dessous',
            valeur_seuil: '500.00',
            statut: 'active',
          },
        ],
      },
      servicePortefeuille: {
        obtenirValeursObservees: async () => ({
          capitalTotal: '100.00',
          capitalComplet: false,
          coursParActif: {},
        }),
      },
    });

    const [alerte] = await service.lister(42);

    // Calculé contre un sous-total, l'écart annoncerait une distance au seuil qui n'est
    // pas la bonne. L'écran porte déjà la mention prévue pour une valeur indisponible.
    expect(alerte.valeur_observee).toBeNull();
    expect(alerte.ecart_pourcentage).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// S-02 — l'identité d'un cours est (type, symbole), jamais le symbole seul
// ---------------------------------------------------------------------------

function cacheEnMemoire() {
  const frais = new Map();
  const dernierConnu = new Map();

  return {
    frais,
    dernierConnu,
    lireCoursCache: async (symbole) => frais.get(symbole) ?? null,
    ecrireCoursCache: async (symbole, cours) => void frais.set(symbole, cours),
    lireDernierCoursConnu: async (symbole) => dernierConnu.get(symbole) ?? null,
    ecrireDernierCoursConnu: async (symbole) => void dernierConnu.set(symbole, symbole),
  };
}

describe('S-02 identité des cours en cache', () => {
  it('ne sert pas le cours crypto à une demande de devise portant le même symbole', async () => {
    const cache = cacheEnMemoire();
    const appels = [];

    const service = creerServiceCours({
      cache,
      adaptateurs: {
        obtenirAdaptateur(type) {
          return {
            async getCours(symbole) {
              appels.push(type);
              return {
                symbole,
                cours_eur: type === 'crypto' ? '3000' : '1.08',
                horodatage: '2026-01-01T12:00:00.000Z',
              };
            },
          };
        },
      },
    });

    await service.getCours('ETH', 'crypto');
    const enDevise = await service.getCours('ETH', 'devise');

    // Sans le type dans la clé, la seconde demande est servie depuis le cache de la
    // première : un cours de cryptomonnaie est rendu pour une devise.
    expect(appels).toEqual(['crypto', 'devise']);
    expect(enDevise.cours_eur).toBe('1.08');
  });

  it('ne replie pas sur le dernier cours connu d\'une autre classe', async () => {
    const cache = cacheEnMemoire();

    const service = creerServiceCours({
      cache,
      adaptateurs: {
        obtenirAdaptateur(type) {
          return {
            async getCours(symbole) {
              if (type !== 'crypto') {
                throw new Error('Fournisseur de devises indisponible');
              }
              return {
                symbole,
                cours_eur: '3000',
                horodatage: '2026-01-01T12:00:00.000Z',
              };
            },
          };
        },
      },
    });

    await service.getCours('ETH', 'crypto');
    cache.frais.clear();

    // Le repli doit rester borné à la classe demandée : à défaut de cours de devise
    // connu, l'appel doit échouer plutôt que rendre un cours de cryptomonnaie.
    await expect(service.getCours('ETH', 'devise')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// S-03 — une catégorie positive n'a jamais une part négative
// ---------------------------------------------------------------------------

function positionsValorisees(valeurs) {
  return valeurs.map(([type, valeur]) => ({
    type,
    valeur,
    cout_total: valeur,
    plus_value_latente: '0',
    plus_value_realisee: '0',
  }));
}

describe('S-03 répartition en pourcentages', () => {
  it('ne rend aucune part négative sur des valeurs toutes positives', () => {
    // Total 50 000. Les trois premières parts arrondissent chacune vers le haut, et le
    // reliquat laissé à la dernière devient négatif.
    const { repartition } = consolider(
      positionsValorisees([
        ['crypto', '16668'],
        ['devise', '16668'],
        ['metal', '16663'],
        ['action', '1'],
      ])
    );

    for (const part of repartition) {
      expect(Number(part.pourcentage)).toBeGreaterThanOrEqual(0);
    }
  });

  it('somme exactement à 100 %', () => {
    const { repartition } = consolider(
      positionsValorisees([
        ['crypto', '16668'],
        ['devise', '16668'],
        ['metal', '16663'],
        ['action', '1'],
      ])
    );

    const somme = repartition.reduce((total, part) => total + Number(part.pourcentage), 0);
    expect(somme).toBeCloseTo(100, 2);
  });

  it('ordonne de façon stable des catégories de même valeur', () => {
    // Le comparateur actuel ne rend jamais 0 : comparer(a, b) et comparer(b, a) valent
    // tous deux -1 à valeurs égales. L'ordre des ex æquo dépend alors de l'algorithme
    // de tri du moteur JavaScript, pas d'une règle du domaine.
    const entrees = positionsValorisees([
      ['crypto', '25'],
      ['devise', '25'],
      ['metal', '25'],
      ['action', '25'],
    ]);

    const premier = consolider(entrees).repartition.map((p) => p.type);
    const second = consolider([...entrees].reverse()).repartition.map((p) => p.type);

    expect(second).toEqual(premier);
  });
});

// ---------------------------------------------------------------------------
// S-04 — une panne de change n'est pas une panne de cotation
// ---------------------------------------------------------------------------

describe('S-04 imputation des pannes de l\'adaptateur actions', () => {
  it('ne consulte pas les trois fournisseurs quand seul le change est indisponible', async () => {
    const appels = [];

    const adaptateur = creerAdaptateurActions({
      recupererJson: async (url) => {
        appels.push(url);
        return [{ price: 190.5, timestamp: 1767268800 }];
      },
      obtenirTauxUsdEur: async () => {
        throw new Error('Frankfurter indisponible');
      },
      fmpApiKey: 'cle-de-test-fmp',
      finnhubApiKey: 'cle-de-test-finnhub',
      alphaVantageApiKey: 'cle-de-test-alpha',
    });

    await expect(adaptateur.getCours('AAPL')).rejects.toThrow();

    // Le taux est obtenu une fois, hors de la boucle des fournisseurs : sans cela, un
    // change indisponible fait échouer les trois cotateurs à tour de rôle et consomme
    // trois appels de quota pour une cause qui ne leur appartient pas.
    expect(appels).toHaveLength(1);
  });

  it('distingue le motif du change de celui de la cotation', async () => {
    const adaptateur = creerAdaptateurActions({
      recupererJson: async () => [{ price: 190.5, timestamp: 1767268800 }],
      obtenirTauxUsdEur: async () => {
        throw new Error('Frankfurter indisponible');
      },
      fmpApiKey: 'cle-de-test-fmp',
      finnhubApiKey: 'cle-de-test-finnhub',
      alphaVantageApiKey: 'cle-de-test-alpha',
    });

    await expect(adaptateur.getCours('AAPL')).rejects.toThrow(/change/i);
  });
});
