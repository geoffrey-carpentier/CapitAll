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
    const service = creerServicePortefeuille({ serviceCours, snapshots: snapshotsFactices(), actifs, transactions });

    await service.obtenirPortefeuille(2);

    expect(serviceCours.getCoursMultiples).toHaveBeenCalledTimes(1);
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

    const service = creerServicePortefeuille({ serviceCours, snapshots: snapshotsFactices(), actifs, transactions });
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
      actifs,
      transactions,
    });

    await expect(service.obtenirDetailActif(999, 2)).rejects.toThrow(/introuvable/);
  });
});
