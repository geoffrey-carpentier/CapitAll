import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

// Concurrence sur la correction d'un mouvement, contre un vrai PostgreSQL.
//
// Aucun modèle en mémoire ne peut établir ce qui suit. Un test unitaire vérifie que le
// service demande un verrou ; il ne vérifie pas que ce verrou bloque, ni qu'une
// transaction relit bien ce que l'autre a écrit avant de décider. Ces deux propriétés
// n'existent que dans la base.
//
// Environnement : docker-compose.test.yml, base isolée, port 5434. Aucune donnée de
// travail n'est atteignable depuis ici.
//
//   docker compose -p walletwatch-test -f docker-compose.test.yml up -d
//   npm run test:integration
//
// Les identifiants ci-dessous sont ceux du fichier de composition de test, littéraux et
// sans équivalent réel. Ils ne sont pas un secret et n'en remplacent aucun.
const URL_BASE_DE_TEST =
  process.env.DATABASE_URL_TEST ??
  'postgresql://walletwatch_test:test_sans_equivalent_reel@127.0.0.1:5434/walletwatch_test';

let pool;
let executerDansTransaction;
let creerServiceTransaction;
let service;
let utilisateurId;
let actifId;

// Deux instants distincts et fixes : l'ordre chronologique des mouvements fait partie de
// ce qui est vérifié, il ne doit pas dépendre de la vitesse d'exécution du test.
const LE_ACHAT = '2026-05-27T10:00:00.000Z';
const LA_VENTE = '2026-07-02T10:00:00.000Z';

async function ouvrirUnSecondClient() {
  return pool.connect();
}

async function poserAchat(quantite = '0.5') {
  const { rows } = await pool.query(
    `INSERT INTO transaction (actif_id, sens, quantite, prix_unitaire, frais, frais_montant, frais_unite, date_transaction)
     VALUES ($1, 'achat', $2, 54000, 0, 0, 'EUR', $3)
     RETURNING id`,
    [actifId, quantite, LE_ACHAT]
  );
  return rows[0].id;
}

async function lireQuantite(id) {
  const { rows } = await pool.query('SELECT quantite FROM transaction WHERE id = $1', [id]);
  return rows[0]?.quantite ?? null;
}

beforeAll(async () => {
  process.env.DATABASE_URL = URL_BASE_DE_TEST;
  process.env.JWT_SECRET = 'd'.repeat(32);

  ({ pool, executerDansTransaction } = await import('../../../db/index.js'));
  ({ creerServiceTransaction } = await import('../../transaction.js'));
  service = creerServiceTransaction();

  // Le test échoue franchement si la base n'est pas là, plutôt que de se déclarer
  // ignoré : un contrôle qui ne s'exécute pas ne doit jamais passer pour exécuté.
  await pool.query('SELECT 1');

  const compte = await pool.query(
    `INSERT INTO utilisateur (email, mot_de_passe_hache, pseudo)
     VALUES ($1, 'sans-valeur', 'integration')
     RETURNING id`,
    [`integration-${Date.now()}@walletwatch.test`]
  );
  utilisateurId = compte.rows[0].id;

  const actif = await pool.query(
    `INSERT INTO actif (utilisateur_id, type, symbole, nom)
     VALUES ($1, 'crypto', 'ITG', 'Actif d''intégration')
     RETURNING id`,
    [utilisateurId]
  );
  actifId = actif.rows[0].id;
});

afterAll(async () => {
  if (utilisateurId) {
    // La cascade emporte l'actif, ses mouvements et ses seuils. Rien de ce que ce
    // fichier a créé ne survit à son exécution.
    await pool.query('DELETE FROM utilisateur WHERE id = $1', [utilisateurId]);
  }
  await pool.end();
});

beforeEach(async () => {
  await pool.query('DELETE FROM transaction WHERE actif_id = $1', [actifId]);
});

function correction(champs) {
  return {
    sens: 'achat',
    quantite: '0.5',
    prix_unitaire: '54000',
    frais: '0',
    date_transaction: LE_ACHAT,
    ...champs,
  };
}

describe('verrou et sérialisation de la correction', () => {
  it('attend qu’une transaction concurrente sur le même actif soit terminée', async () => {
    const idAchat = await poserAchat('0.5');
    const concurrent = await ouvrirUnSecondClient();

    let terminee = false;
    try {
      await concurrent.query('BEGIN');
      await concurrent.query('SELECT id FROM actif WHERE id = $1 FOR UPDATE', [actifId]);

      const correctionEnCours = service
        .modifier({
          actifId,
          idTransaction: idAchat,
          utilisateurId,
          donnees: correction({ prix_unitaire: '52000' }),
        })
        .then(() => {
          terminee = true;
        });

      // Le verrou est tenu ailleurs : la correction ne peut pas avoir abouti.
      await new Promise((resoudre) => setTimeout(resoudre, 300));
      expect(terminee).toBe(false);
      expect(await lireQuantite(idAchat)).not.toBeNull();

      await concurrent.query('COMMIT');
      await correctionEnCours;
      expect(terminee).toBe(true);
    } finally {
      concurrent.release();
    }
  });

  it('relit ce que la transaction concurrente a écrit avant de décider', async () => {
    // C'est la propriété qui compte, et celle qu'un test unitaire ne peut pas voir.
    // La correction ramène l'achat de 0,5 à 0,4 : prise seule, elle est valide. Pendant
    // qu'elle attend le verrou, une vente de 0,45 est enregistrée. À la reprise, elle
    // doit constater cette vente et refuser — sans quoi la position passerait à −0,05.
    const idAchat = await poserAchat('0.5');
    const concurrent = await ouvrirUnSecondClient();

    try {
      await concurrent.query('BEGIN');
      await concurrent.query('SELECT id FROM actif WHERE id = $1 FOR UPDATE', [actifId]);

      const correctionEnCours = service.modifier({
        actifId,
        idTransaction: idAchat,
        utilisateurId,
        donnees: correction({ quantite: '0.4' }),
      });

      await concurrent.query(
        `INSERT INTO transaction (actif_id, sens, quantite, prix_unitaire, frais, frais_montant, frais_unite, date_transaction)
         VALUES ($1, 'vente', 0.45, 63500, 0, 0, 'EUR', $2)`,
        [actifId, LA_VENTE]
      );
      await concurrent.query('COMMIT');

      await expect(correctionEnCours).rejects.toThrow(
        /mouvement postérieur deviendrait impossible/
      );
    } finally {
      concurrent.release();
    }

    // Et la ligne n'a pas bougé : le refus ne laisse rien derrière lui.
    expect(await lireQuantite(idAchat)).toBe('0.500000000000000000');
  });

  it('laisse la base cohérente quand deux corrections partent en même temps', async () => {
    const idAchat = await poserAchat('0.5');

    // Aucune des deux n'est fautive prise seule ; l'ordre dans lequel elles sont
    // sérialisées ne se prédit pas, et n'a pas à l'être. Ce qui doit être vrai, c'est
    // que la valeur finale est l'une des deux, jamais un mélange.
    const resultats = await Promise.allSettled([
      service.modifier({
        actifId,
        idTransaction: idAchat,
        utilisateurId,
        donnees: correction({ prix_unitaire: '52000' }),
      }),
      service.modifier({
        actifId,
        idTransaction: idAchat,
        utilisateurId,
        donnees: correction({ prix_unitaire: '53000' }),
      }),
    ]);

    expect(resultats.every((resultat) => resultat.status === 'fulfilled')).toBe(true);

    const { rows } = await pool.query(
      'SELECT prix_unitaire FROM transaction WHERE id = $1',
      [idAchat]
    );
    expect(['52000.000000000000000000', '53000.000000000000000000']).toContain(
      rows[0].prix_unitaire
    );
  });

  it('refuse la correction quand une vente concurrente la rend impossible, dans les deux ordres', async () => {
    const idAchat = await poserAchat('0.5');

    // Réduire l'achat à 0,4 et vendre 0,45 sont incompatibles. Quel que soit l'ordre
    // retenu par la base, exactement une des deux opérations doit aboutir.
    const resultats = await Promise.allSettled([
      service.modifier({
        actifId,
        idTransaction: idAchat,
        utilisateurId,
        donnees: correction({ quantite: '0.4' }),
      }),
      service.enregistrer({
        actifId,
        utilisateurId,
        donnees: {
          sens: 'vente',
          quantite: '0.45',
          prix_unitaire: '63500',
          frais: '0',
          date_transaction: LA_VENTE,
        },
      }),
    ]);

    const reussies = resultats.filter((resultat) => resultat.status === 'fulfilled');
    expect(reussies).toHaveLength(1);

    // Et l'invariant tient dans la base : la quantité détenue reste positive.
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN sens = 'achat' THEN quantite ELSE -quantite END), 0) AS detenu
       FROM transaction WHERE actif_id = $1`,
      [actifId]
    );
    expect(Number(rows[0].detenu)).toBeGreaterThanOrEqual(0);
  });

  it('ne rend pas un mouvement déjà supprimé par une transaction concurrente', async () => {
    const idAchat = await poserAchat('0.5');
    const concurrent = await ouvrirUnSecondClient();

    try {
      await concurrent.query('BEGIN');
      await concurrent.query('SELECT id FROM actif WHERE id = $1 FOR UPDATE', [actifId]);

      const correctionEnCours = service.modifier({
        actifId,
        idTransaction: idAchat,
        utilisateurId,
        donnees: correction({ prix_unitaire: '52000' }),
      });

      await concurrent.query('DELETE FROM transaction WHERE id = $1', [idAchat]);
      await concurrent.query('COMMIT');

      // La relecture a lieu après le verrou : le mouvement a disparu entre-temps, et la
      // correction rend un 404 plutôt que de réécrire une ligne qui n'existe plus.
      await expect(correctionEnCours).rejects.toThrow(/Transaction introuvable/);
    } finally {
      concurrent.release();
    }
  });
});

describe('cloisonnement, en base', () => {
  it('rend 404 sur le mouvement d’un autre compte', async () => {
    const idAchat = await poserAchat('0.5');

    const autre = await pool.query(
      `INSERT INTO utilisateur (email, mot_de_passe_hache, pseudo)
       VALUES ($1, 'sans-valeur', 'autre')
       RETURNING id`,
      [`autre-${Date.now()}@walletwatch.test`]
    );

    try {
      await expect(
        service.modifier({
          actifId,
          idTransaction: idAchat,
          utilisateurId: autre.rows[0].id,
          donnees: correction({ prix_unitaire: '1' }),
        })
      ).rejects.toThrow(/Transaction introuvable/);

      expect(await lireQuantite(idAchat)).toBe('0.500000000000000000');
    } finally {
      await pool.query('DELETE FROM utilisateur WHERE id = $1', [autre.rows[0].id]);
    }
  });
});

describe('atomicité de la correction', () => {
  it('n’écrit rien lorsque la règle refuse, même partiellement', async () => {
    const idAchat = await poserAchat('0.5');
    await pool.query(
      `INSERT INTO transaction (actif_id, sens, quantite, prix_unitaire, frais, frais_montant, frais_unite, date_transaction)
       VALUES ($1, 'vente', 0.45, 63500, 0, 0, 'EUR', $2)`,
      [actifId, LA_VENTE]
    );

    await expect(
      service.modifier({
        actifId,
        idTransaction: idAchat,
        utilisateurId,
        donnees: correction({ quantite: '0.4', prix_unitaire: '1' }),
      })
    ).rejects.toThrow(/mouvement postérieur deviendrait impossible/);

    const { rows } = await pool.query(
      'SELECT quantite, prix_unitaire FROM transaction WHERE id = $1',
      [idAchat]
    );
    // Ni la quantité refusée, ni le prix qui l'accompagnait : le refus précède
    // l'écriture, et la transaction est annulée de toute façon.
    expect(rows[0].quantite).toBe('0.500000000000000000');
    expect(rows[0].prix_unitaire).toBe('54000.000000000000000000');
  });

  it('conserve l’identité et la note du mouvement corrigé', async () => {
    // C'était le défaut réel de D51 : la cascade destructive perdait la date, la note et
    // l'identité des mouvements intermédiaires. Corriger les préserve.
    const { rows } = await pool.query(
      `INSERT INTO transaction (actif_id, sens, quantite, prix_unitaire, frais, frais_montant, frais_unite, date_transaction, note)
       VALUES ($1, 'achat', 0.5, 54000, 0, 0, 'EUR', $2, 'Achat initial')
       RETURNING id`,
      [actifId, LE_ACHAT]
    );
    const idAchat = rows[0].id;

    const modifiee = await service.modifier({
      actifId,
      idTransaction: idAchat,
      utilisateurId,
      donnees: correction({ prix_unitaire: '52000', note: 'Prix corrigé' }),
    });

    expect(String(modifiee.id)).toBe(String(idAchat));
    expect(modifiee.note).toBe('Prix corrigé');
    expect(new Date(modifiee.date_transaction).toISOString()).toBe(LE_ACHAT);
  });
});

// Le module de transaction est importé pour lui-même dans certains tests ; la référence
// évite qu'un linter le juge inutilisé lorsque seul le service par défaut sert.
void executerDansTransaction;
