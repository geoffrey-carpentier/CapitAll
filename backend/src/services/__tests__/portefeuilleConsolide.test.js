import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// Le service tire la configuration par sa chaîne d'imports : environnement minimal
// posé avant l'import dynamique, comme pour les autres modules qui en dépendent.
let creerServicePortefeuille;

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://utilisateur:secret@localhost:5432/capitall';
  process.env.JWT_SECRET = 'd'.repeat(32);
  ({ creerServicePortefeuille } = await import('../portefeuilleConsolide.js'));
});

// Dépôts factices : le service reçoit ses modèles en paramètre, aucun accès à la base.
function depotActifs(liste, actifUnique) {
  return {
    listerParUtilisateur: vi.fn().mockResolvedValue(liste),
    trouverParIdEtUtilisateur: vi.fn().mockResolvedValue(actifUnique ?? null),
  };
}

function depotTransactions(liste) {
  return { listerParActifEtUtilisateur: vi.fn().mockResolvedValue(liste) };
}

function depotAlertes(actives = []) {
  return {
    listerActivesParUtilisateur: vi.fn().mockResolvedValue(actives),
    marquerDeclenchees: vi.fn().mockResolvedValue(actives.length),
  };
}

const ACTIF_BTC = { id: 1, type: 'crypto', symbole: 'BTC', nom: 'Bitcoin', utilisateur_id: 2 };

const TRANSACTIONS_BTC = [
  { id: 1, sens: 'achat', quantite: '1', prix_unitaire: '100.00', frais: '0', date_transaction: '2026-01-10' },
];

function serviceCoursFactice(cours) {
  return {
    getCoursMultiples: vi.fn().mockResolvedValue(cours),
    getCours: vi.fn().mockResolvedValue({
      symbole: 'USD',
      cours_eur: '0.88',
      horodatage: '2026-07-30T00:00:00.000Z',
      source: 'cache',
    }),
  };
}

function snapshotsFactices() {
  return {
    enregistrerSiAbsent: vi.fn().mockResolvedValue({ id: 1 }),
    listerParUtilisateur: vi.fn().mockResolvedValue([]),
  };
}

// Historique de cours par position (D81). Vide par defaut : la plupart des cas ne
// portent pas sur la tendance, et une serie vide est l'etat reel d'un compte neuf.
function snapshotsCoursFactices(series = []) {
  return {
    enregistrerSiAbsent: vi.fn().mockResolvedValue([]),
    listerParActif: vi.fn().mockResolvedValue(series),
    listerRecentsParUtilisateur: vi.fn().mockResolvedValue(series),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('portefeuille consolidé', () => {
  it('valorise les actifs et enregistre le snapshot du jour', async () => {
    const actifs = depotActifs([ACTIF_BTC]);
    const transactions = depotTransactions(TRANSACTIONS_BTC);

    const snapshots = snapshotsFactices();
    const service = creerServicePortefeuille({
      serviceCours: serviceCoursFactice([
        { symbole: 'BTC', cours_eur: '150.00', horodatage: '2026-07-30T10:00:00Z', source: 'cache' },
      ]),
      snapshots,
      snapshotsCours: snapshotsCoursFactices(),
      actifs,
      transactions,
    });

    const portefeuille = await service.obtenirPortefeuille(2);

    expect(portefeuille.valeur_totale).toBe('150.00');
    expect(portefeuille.plus_value_latente).toBe('50.00');
    expect(portefeuille.actifs[0].symbole).toBe('BTC');
    expect(snapshots.enregistrerSiAbsent).toHaveBeenCalledWith(2, '150.00');
  });

  it('expose le taux de change pour la bascule d\'affichage', async () => {
    const actifs = depotActifs([]);
    const transactions = depotTransactions([]);

    const service = creerServicePortefeuille({
      serviceCours: serviceCoursFactice([]),
      snapshots: snapshotsFactices(),
      snapshotsCours: snapshotsCoursFactices(),
      actifs,
      transactions,
    });

    const portefeuille = await service.obtenirPortefeuille(2);

    expect(portefeuille.taux_affichage.usd_vers_eur).toBe('0.88');
    expect(portefeuille.taux_affichage.eur_vers_usd).not.toBeNull();
  });

  // Un cours manquant ne doit pas priver l'utilisateur du reste de son portefeuille.
  it('signale les cours indisponibles sans invalider la réponse', async () => {
    const actifs = depotActifs([ACTIF_BTC]);
    const transactions = depotTransactions(TRANSACTIONS_BTC);

    const service = creerServicePortefeuille({
      serviceCours: serviceCoursFactice([{ symbole: 'BTC', erreur: 'fournisseur injoignable' }]),
      snapshots: snapshotsFactices(),
      snapshotsCours: snapshotsCoursFactices(),
      actifs,
      transactions,
    });

    const portefeuille = await service.obtenirPortefeuille(2);

    expect(portefeuille.cours_indisponibles).toContain('BTC');
    expect(portefeuille.actifs[0].valeur).toBeNull();
    expect(portefeuille.actifs[0].quantite_detenue).toBe('1');
  });

  // Un point faux dans l'historique est pire qu'un trou dans la courbe.
  it("n'enregistre aucun snapshot si aucun cours n'est disponible", async () => {
    const actifs = depotActifs([ACTIF_BTC]);
    const transactions = depotTransactions(TRANSACTIONS_BTC);

    const snapshots = snapshotsFactices();
    const service = creerServicePortefeuille({
      serviceCours: serviceCoursFactice([{ symbole: 'BTC', erreur: 'injoignable' }]),
      snapshots,
      snapshotsCours: snapshotsCoursFactices(),
      actifs,
      transactions,
    });

    await service.obtenirPortefeuille(2);

    expect(snapshots.enregistrerSiAbsent).not.toHaveBeenCalled();
  });

  // L'historisation est un effet de bord : son échec ne prive pas l'utilisateur
  // de son portefeuille.
  it("rend le portefeuille même si l'écriture du snapshot échoue", async () => {
    const actifs = depotActifs([ACTIF_BTC]);
    const transactions = depotTransactions(TRANSACTIONS_BTC);

    const snapshots = snapshotsFactices();
    snapshots.enregistrerSiAbsent.mockRejectedValue(new Error('base indisponible'));

    const service = creerServicePortefeuille({
      serviceCours: serviceCoursFactice([
        { symbole: 'BTC', cours_eur: '150.00', horodatage: '2026-07-30T10:00:00Z', source: 'cache' },
      ]),
      snapshots,
      snapshotsCours: snapshotsCoursFactices(),
      actifs,
      transactions,
    });

    const portefeuille = await service.obtenirPortefeuille(2);

    expect(portefeuille.valeur_totale).toBe('150.00');
  });

  it('rend un portefeuille vide sans erreur pour un compte neuf', async () => {
    const actifs = depotActifs([]);
    const transactions = depotTransactions([]);

    const service = creerServicePortefeuille({
      serviceCours: serviceCoursFactice([]),
      snapshots: snapshotsFactices(),
      snapshotsCours: snapshotsCoursFactices(),
      actifs,
      transactions,
    });

    const portefeuille = await service.obtenirPortefeuille(9);

    expect(portefeuille.valeur_totale).toBe('0.00');
    expect(portefeuille.actifs).toEqual([]);
    expect(portefeuille.repartition).toEqual([]);
  });

  it('ne demande les cours qu\'une seule fois pour tout le portefeuille', async () => {
    const actifs = depotActifs([
      ACTIF_BTC,
      { id: 2, type: 'crypto', symbole: 'ETH', nom: 'Ethereum', utilisateur_id: 2 },
    ]);
    const transactions = depotTransactions(TRANSACTIONS_BTC);

    const serviceCours = serviceCoursFactice([
      { symbole: 'BTC', cours_eur: '150.00', horodatage: '2026-07-30T10:00:00Z', source: 'cache' },
      { symbole: 'ETH', cours_eur: '10.00', horodatage: '2026-07-30T10:00:00Z', source: 'cache' },
    ]);
    const service = creerServicePortefeuille({ serviceCours, snapshots: snapshotsFactices(),
      snapshotsCours: snapshotsCoursFactices(),
      actifs,
      transactions,
    });

    await service.obtenirPortefeuille(2);

    expect(serviceCours.getCoursMultiples).toHaveBeenCalledTimes(1);
  });
});

describe('évaluation des alertes au chargement', () => {
  it('signale les alertes franchies et les marque déclenchées', async () => {
    const actifs = depotActifs([ACTIF_BTC]);
    const transactions = depotTransactions(TRANSACTIONS_BTC);
    const alertes = depotAlertes([
      {
        id: 7,
        type_cible: 'capital_total',
        actif_id: null,
        sens_seuil: 'au_dessus',
        valeur_seuil: '100.00',
        statut: 'active',
      },
    ]);

    const service = creerServicePortefeuille({
      serviceCours: serviceCoursFactice([
        { symbole: 'BTC', cours_eur: '150.00', horodatage: '2026-07-30T10:00:00Z', source: 'cache' },
      ]),
      snapshots: snapshotsFactices(),
      snapshotsCours: snapshotsCoursFactices(),
      actifs,
      transactions,
      alertes,
    });

    const portefeuille = await service.obtenirPortefeuille(2);

    expect(portefeuille.alertes_declenchees).toHaveLength(1);
    expect(portefeuille.alertes_declenchees[0].valeur_observee).toBe('150.00');
    expect(alertes.marquerDeclenchees).toHaveBeenCalledWith(2, [7]);
  });

  it("ne marque rien quand aucun seuil n'est franchi", async () => {
    const actifs = depotActifs([ACTIF_BTC]);
    const transactions = depotTransactions(TRANSACTIONS_BTC);
    const alertes = depotAlertes([
      {
        id: 8,
        type_cible: 'capital_total',
        actif_id: null,
        sens_seuil: 'au_dessus',
        valeur_seuil: '999999.00',
        statut: 'active',
      },
    ]);

    const service = creerServicePortefeuille({
      serviceCours: serviceCoursFactice([
        { symbole: 'BTC', cours_eur: '150.00', horodatage: '2026-07-30T10:00:00Z', source: 'cache' },
      ]),
      snapshots: snapshotsFactices(),
      snapshotsCours: snapshotsCoursFactices(),
      actifs,
      transactions,
      alertes,
    });

    const portefeuille = await service.obtenirPortefeuille(2);

    expect(portefeuille.alertes_declenchees).toEqual([]);
    expect(alertes.marquerDeclenchees).not.toHaveBeenCalled();
  });

  // L'évaluation est un effet de bord, au même titre que l'historisation : son échec
  // ne doit pas priver l'utilisateur de son portefeuille.
  it("rend le portefeuille même si l'évaluation des alertes échoue", async () => {
    const actifs = depotActifs([ACTIF_BTC]);
    const transactions = depotTransactions(TRANSACTIONS_BTC);
    const alertes = depotAlertes();
    alertes.listerActivesParUtilisateur.mockRejectedValue(new Error('base indisponible'));

    const service = creerServicePortefeuille({
      serviceCours: serviceCoursFactice([
        { symbole: 'BTC', cours_eur: '150.00', horodatage: '2026-07-30T10:00:00Z', source: 'cache' },
      ]),
      snapshots: snapshotsFactices(),
      snapshotsCours: snapshotsCoursFactices(),
      actifs,
      transactions,
      alertes,
    });

    const portefeuille = await service.obtenirPortefeuille(2);

    expect(portefeuille.valeur_totale).toBe('150.00');
    expect(portefeuille.alertes_declenchees).toEqual([]);
  });
});

describe("détail d'un actif", () => {
  it('rend la position, le cours et les transactions', async () => {
    const actifs = depotActifs([], ACTIF_BTC);
    const transactions = depotTransactions(TRANSACTIONS_BTC);

    const serviceCours = serviceCoursFactice([]);
    serviceCours.getCours = vi.fn().mockResolvedValue({
      symbole: 'BTC',
      cours_eur: '150.00',
      horodatage: '2026-07-30T10:00:00Z',
      source: 'fournisseur',
    });

    const service = creerServicePortefeuille({ serviceCours, snapshots: snapshotsFactices(),
      snapshotsCours: snapshotsCoursFactices(),
      actifs,
      transactions,
    });
    const detail = await service.obtenirDetailActif(1, 2);

    expect(detail.pru).toBe('100');
    expect(detail.valeur).toBe('150.00');
    expect(detail.source_cours).toBe('fournisseur');
    expect(detail.transactions).toHaveLength(1);
  });

  it("refuse un actif appartenant à un autre utilisateur", async () => {
    const actifs = depotActifs([], null);
    const transactions = depotTransactions([]);

    const service = creerServicePortefeuille({
      serviceCours: serviceCoursFactice([]),
      snapshots: snapshotsFactices(),
      snapshotsCours: snapshotsCoursFactices(),
      actifs,
      transactions,
    });

    await expect(service.obtenirDetailActif(999, 2)).rejects.toThrow(/introuvable/);
  });
});

describe('historique du portefeuille', () => {
  const SERIE = [
    { date_snapshot: '2026-03-29', valeur_totale_eur: '1000.00' },
    { date_snapshot: '2026-03-30', valeur_totale_eur: '1100.00' },
    { date_snapshot: '2026-03-31', valeur_totale_eur: '1210.00' },
  ];

  function snapshotsAvecSerie(serie, fenetre) {
    return {
      enregistrerSiAbsent: vi.fn().mockResolvedValue({ id: 1 }),
      listerParUtilisateur: vi
        .fn()
        .mockImplementation((_utilisateurId, jours) =>
          Promise.resolve(jours ? (fenetre ?? serie) : serie)
        ),
    };
  }

  it('rend les points de la période et la performance de chaque plage', async () => {
    const snapshots = snapshotsAvecSerie(SERIE);
    const service = creerServicePortefeuille({
      serviceCours: serviceCoursFactice([]),
      snapshots,
      snapshotsCours: snapshotsCoursFactices(),
      actifs: depotActifs([]),
      transactions: depotTransactions([]),
      alertes: depotAlertes(),
    });

    const historique = await service.obtenirHistorique(2);

    expect(historique.points).toHaveLength(3);
    expect(historique.performances.jour).toBe('10.00');
    expect(historique.performances.origine).toBe('21.00');
  });

  // La performance depuis l'origine ne se déduit pas d'une fenêtre d'un jour : les
  // plages se calculent sur l'historique complet, la fenêtre ne borne que la courbe.
  it("calcule les plages sur l'historique complet, pas sur la fenêtre demandée", async () => {
    const fenetre = SERIE.slice(-2);
    const snapshots = snapshotsAvecSerie(SERIE, fenetre);
    const service = creerServicePortefeuille({
      serviceCours: serviceCoursFactice([]),
      snapshots,
      snapshotsCours: snapshotsCoursFactices(),
      actifs: depotActifs([]),
      transactions: depotTransactions([]),
      alertes: depotAlertes(),
    });

    const historique = await service.obtenirHistorique(2, 1);

    expect(historique.points).toHaveLength(2);
    expect(historique.performances.origine).toBe('21.00');
    expect(snapshots.listerParUtilisateur).toHaveBeenCalledTimes(2);
  });

  it('rend des plages vides sur un historique trop court', async () => {
    const service = creerServicePortefeuille({
      serviceCours: serviceCoursFactice([]),
      snapshots: snapshotsAvecSerie([SERIE[0]]),
      snapshotsCours: snapshotsCoursFactices(),
      actifs: depotActifs([]),
      transactions: depotTransactions([]),
      alertes: depotAlertes(),
    });

    const historique = await service.obtenirHistorique(2);

    expect(historique.points).toHaveLength(1);
    expect(historique.performances.origine).toBeNull();
  });
});

// Historique de cours par position (D81).
//
// L'alimentation reutilise l'ecriture paresseuse de D49 : aucune tache planifiee, le
// meme point d'appel, les memes garanties d'effet de bord.
describe('historique de cours par position', () => {
  const SERIE_BTC = [
    { actif_id: 1, date_snapshot: '2026-07-01', cours_eur: '100.00' },
    { actif_id: 1, date_snapshot: '2026-07-15', cours_eur: '120.00' },
    { actif_id: 1, date_snapshot: '2026-07-30', cours_eur: '150.00' },
  ];

  function service(snapshotsCours, cours = '150.00') {
    return creerServicePortefeuille({
      serviceCours: serviceCoursFactice([
        { symbole: 'BTC', cours_eur: cours, horodatage: '2026-07-30T10:00:00Z', source: 'cache' },
      ]),
      snapshots: snapshotsFactices(),
      snapshotsCours,
      actifs: depotActifs([ACTIF_BTC], ACTIF_BTC),
      transactions: depotTransactions(TRANSACTIONS_BTC),
    });
  }

  it("historise les positions valorisees au meme point d'appel que le portefeuille", async () => {
    const snapshotsCours = snapshotsCoursFactices();
    await service(snapshotsCours).obtenirPortefeuille(2);

    expect(snapshotsCours.enregistrerSiAbsent).toHaveBeenCalledTimes(1);
    const [utilisateurId, positions] = snapshotsCours.enregistrerSiAbsent.mock.calls[0];
    expect(utilisateurId).toBe(2);
    expect(positions[0]).toMatchObject({ id: 1, cours_eur: '150.00', quantite_detenue: '1' });
  });

  // Meme regle que pour le snapshot de valorisation : l'historisation est un effet de
  // bord, son echec ne prive pas l'utilisateur de son portefeuille.
  it("rend le portefeuille meme si l'historisation des cours echoue", async () => {
    const snapshotsCours = snapshotsCoursFactices();
    snapshotsCours.enregistrerSiAbsent.mockRejectedValue(new Error('base indisponible'));

    const portefeuille = await service(snapshotsCours).obtenirPortefeuille(2);

    expect(portefeuille.valeur_totale).toBe('150.00');
  });

  it('expose la tendance de chaque position sur la fenetre de trente jours', async () => {
    const snapshotsCours = snapshotsCoursFactices(SERIE_BTC);
    const portefeuille = await service(snapshotsCours).obtenirPortefeuille(2);

    expect(snapshotsCours.listerRecentsParUtilisateur).toHaveBeenCalledWith(2, 30);
    // De 100 a 150, soit cinquante pour cent, verifiable de tete.
    expect(portefeuille.actifs[0].tendance_30j.variation).toBe('50.00');
    expect(portefeuille.actifs[0].tendance_30j.points).toEqual(['100.00', '120.00', '150.00']);
  });

  // Un point isole ne dit rien d'une evolution : la variation est absente, et
  // l'interface affiche son etat << pas assez de points >> plutot qu'un zero.
  it('ne fabrique aucune tendance sur un historique trop court', async () => {
    const snapshotsCours = snapshotsCoursFactices([SERIE_BTC[0]]);
    const portefeuille = await service(snapshotsCours).obtenirPortefeuille(2);

    expect(portefeuille.actifs[0].tendance_30j.variation).toBeNull();
  });

  it("rend une tendance absente lorsque la position n'a aucun historique", async () => {
    const portefeuille = await service(snapshotsCoursFactices()).obtenirPortefeuille(2);

    expect(portefeuille.actifs[0].tendance_30j).toBeNull();
  });

  // Une lecture d'historique en echec ne doit pas vider le portefeuille : la colonne
  // de tendance se comporte alors comme pour un actif trop jeune.
  it('rend le portefeuille meme si la lecture des tendances echoue', async () => {
    const snapshotsCours = snapshotsCoursFactices();
    snapshotsCours.listerRecentsParUtilisateur.mockRejectedValue(new Error('base indisponible'));

    const portefeuille = await service(snapshotsCours).obtenirPortefeuille(2);

    expect(portefeuille.valeur_totale).toBe('150.00');
    expect(portefeuille.actifs[0].tendance_30j).toBeNull();
  });

  it("joint au detail d'un actif sa serie de cours et la performance de chaque plage", async () => {
    const snapshotsCours = snapshotsCoursFactices(SERIE_BTC);
    const detail = await service(snapshotsCours).obtenirDetailActif(1, 2);

    // Le cloisonnement passe par le SQL : le modele recoit toujours le proprietaire.
    expect(snapshotsCours.listerParActif).toHaveBeenCalledWith(1, 2);
    expect(detail.historique.points).toHaveLength(3);
    expect(detail.historique.performances.origine).toBe('50.00');
  });

  it("rend un historique vide plutot qu'absent pour une position trop jeune", async () => {
    const detail = await service(snapshotsCoursFactices()).obtenirDetailActif(1, 2);

    expect(detail.historique.points).toEqual([]);
    expect(detail.historique.performances.origine).toBeNull();
  });

  it("rend le detail meme si la lecture de l'historique echoue", async () => {
    const snapshotsCours = snapshotsCoursFactices();
    snapshotsCours.listerParActif.mockRejectedValue(new Error('base indisponible'));

    const detail = await service(snapshotsCours).obtenirDetailActif(1, 2);

    expect(detail.pru).toBe('100');
    expect(detail.transactions).toHaveLength(1);
    expect(detail.historique.points).toEqual([]);
  });
});
