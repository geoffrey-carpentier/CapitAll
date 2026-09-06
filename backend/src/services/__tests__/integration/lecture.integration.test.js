import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

// Lecture pure et heure de relevé, contre un vrai PostgreSQL (IDEM-01, DATA-04).
//
// Un test à modèles factices vérifie que le service n'appelle pas la fonction qui écrit.
// Il ne vérifie pas qu'aucune ligne n'apparaît : un autre chemin pourrait écrire, une
// requête pourrait avoir un effet que le double ne reproduit pas. Ce qui suit compte les
// lignes réellement présentes avant et après, ce qu'aucun double ne peut établir.
//
// Environnement : docker-compose.test.yml, base isolée, port 5434. Aucune donnée de
// travail n'est atteignable depuis ici.
//
//   docker compose -p walletwatch-test -f docker-compose.test.yml up -d
//   npm run test:integration
const URL_BASE_DE_TEST =
  process.env.DATABASE_URL_TEST ??
  'postgresql://walletwatch_test:test_sans_equivalent_reel@127.0.0.1:5434/walletwatch_test';

let pool;
let creerServicePortefeuille;
let utilisateurId;
let actifId;

// Le cours ne doit pas dépendre d'un fournisseur : ce qui est mesuré ici est l'écriture,
// pas la cotation.
function serviceCoursFactice() {
  return {
    getCoursMultiples: async () => [
      { symbole: 'BTC', cours_eur: '54000', horodatage: '2026-09-06T10:00:00.000Z', source: 'cache' },
    ],
    getCours: async () => ({
      symbole: 'USD',
      cours_eur: '0.88',
      horodatage: '2026-09-06T10:00:00.000Z',
      source: 'cache',
    }),
  };
}

async function compter(table, condition, parametres) {
  const { rows } = await pool.query(`SELECT count(*)::int AS total FROM ${table} WHERE ${condition}`, parametres);
  return rows[0].total;
}

async function comptages() {
  return {
    valorisations: await compter('snapshot_valorisation', 'utilisateur_id = $1', [utilisateurId]),
    cours: await compter('snapshot_cours', 'actif_id = $1', [actifId]),
  };
}

beforeAll(async () => {
  process.env.DATABASE_URL = URL_BASE_DE_TEST;
  process.env.JWT_SECRET = 'd'.repeat(32);

  ({ pool } = await import('../../../db/index.js'));
  ({ creerServicePortefeuille } = await import('../../portefeuilleConsolide.js'));
});

afterAll(async () => {
  await pool?.end();
});

beforeEach(async () => {
  // Un compte neuf par test : les deux séries historiques portent une contrainte
  // d'unicité au jour, et deux tests partageant un compte se marcheraient dessus.
  const suffixe = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const { rows: comptes } = await pool.query(
    `INSERT INTO utilisateur (email, mot_de_passe_hache, pseudo)
     VALUES ($1, 'sans-objet-pour-ce-test', 'Lecture') RETURNING id`,
    [`lecture-${suffixe}@exemple.test`]
  );
  utilisateurId = comptes[0].id;

  const { rows: actifs } = await pool.query(
    `INSERT INTO actif (utilisateur_id, type, symbole, nom)
     VALUES ($1, 'crypto', 'BTC', 'Bitcoin') RETURNING id`,
    [utilisateurId]
  );
  actifId = actifs[0].id;

  await pool.query(
    `INSERT INTO transaction (actif_id, sens, quantite, prix_unitaire, frais, frais_montant, frais_unite, date_transaction)
     VALUES ($1, 'achat', 0.5, 40000, 0, 0, 'EUR', '2026-05-27T10:00:00.000Z')`,
    [actifId]
  );
});

describe('lecture du portefeuille contre une base réelle', () => {
  it("n'insère aucune ligne dans les deux séries historiques", async () => {
    const service = creerServicePortefeuille({ serviceCours: serviceCoursFactice() });

    const avant = await comptages();
    const portefeuille = await service.obtenirPortefeuille(utilisateurId);
    const apres = await comptages();

    // La réponse est complète : c'est bien une lecture utile, pas une lecture vide.
    expect(portefeuille.valeur_totale).toBe('27000.00');
    expect(avant).toEqual({ valorisations: 0, cours: 0 });
    expect(apres).toEqual({ valorisations: 0, cours: 0 });
  });

  it('écrit les deux séries à l\'actualisation, avec leur heure de relevé', async () => {
    const service = creerServicePortefeuille({ serviceCours: serviceCoursFactice() });

    await service.actualiserPortefeuille(utilisateurId);

    const { rows: valorisations } = await pool.query(
      'SELECT valeur_totale_eur, heure_releve FROM snapshot_valorisation WHERE utilisateur_id = $1',
      [utilisateurId]
    );
    const { rows: cours } = await pool.query(
      'SELECT cours_eur, heure_releve FROM snapshot_cours WHERE actif_id = $1',
      [actifId]
    );

    expect(valorisations).toHaveLength(1);
    expect(valorisations[0].valeur_totale_eur).toBe('27000.00');
    // L'heure du relevé est ce qui permet à la courbe d'annoncer un pas irrégulier au
    // lieu de le taire.
    expect(valorisations[0].heure_releve).toBeInstanceOf(Date);
    expect(cours).toHaveLength(1);
    expect(cours[0].heure_releve).toBeInstanceOf(Date);
  });

  it("n'écrit pas deux fois le point du jour", async () => {
    const service = creerServicePortefeuille({ serviceCours: serviceCoursFactice() });

    await service.actualiserPortefeuille(utilisateurId);
    const apresLaPremiere = await comptages();
    await service.actualiserPortefeuille(utilisateurId);
    const apresLaSeconde = await comptages();

    // L'unicité au jour est portée par la base, pas par un contrôle préalable : deux
    // onglets actualisant en même temps passeraient tous deux un contrôle d'existence.
    expect(apresLaPremiere).toEqual({ valorisations: 1, cours: 1 });
    expect(apresLaSeconde).toEqual({ valorisations: 1, cours: 1 });
  });

  it('lit sans rien changer même après une actualisation', async () => {
    const service = creerServicePortefeuille({ serviceCours: serviceCoursFactice() });

    await service.actualiserPortefeuille(utilisateurId);
    const avant = await comptages();

    await service.obtenirPortefeuille(utilisateurId);
    await service.obtenirPortefeuille(utilisateurId);

    expect(await comptages()).toEqual(avant);
  });
});
