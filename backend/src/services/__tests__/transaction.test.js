import { describe, it, expect, vi, beforeAll } from 'vitest';

// Le service tire la configuration par sa chaîne d'imports : environnement minimal
// posé avant l'import dynamique, comme pour les autres modules qui en dépendent.
let creerServiceTransaction;

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://utilisateur:secret@localhost:5432/capitall';
  process.env.JWT_SECRET = 'd'.repeat(32);
  ({ creerServiceTransaction } = await import('../transaction.js'));
});

// Le service est monté avec des modèles en mémoire : aucune base n'est nécessaire pour
// vérifier l'enregistrement d'un mouvement ni la simulation de son effet.
//
// Les chiffres attendus sont ceux du moteur de calcul, repris de ses six règles (D54) :
// un achat recalcule le prix de revient en moyenne pondérée, frais compris ; une vente
// le laisse intact et dégage une plus-value.

const ACTIF = { id: 7, utilisateur_id: 2, type: 'crypto', symbole: 'BTC', nom: 'Bitcoin' };

// 0,5 à 54 000 avec 15 de frais, puis 0,3 à 61 000 avec 10 de frais : (27 015 + 18 310)
// divisé par 0,8, soit un prix de revient de 56 656,25 sur 0,8 unité détenue.
const HISTORIQUE = [
  {
    id: 1,
    sens: 'achat',
    quantite: '0.50000000',
    prix_unitaire: '54000.00',
    frais: '15.00',
    date_transaction: '2026-05-27T10:00:00.000Z',
  },
  {
    id: 2,
    sens: 'achat',
    quantite: '0.30000000',
    prix_unitaire: '61000.00',
    frais: '10.00',
    date_transaction: '2026-07-02T10:00:00.000Z',
  },
];

function monter({ actif = ACTIF, historique = HISTORIQUE } = {}) {
  const executer = vi.fn();
  const actifs = {
    trouverParIdEtUtilisateur: vi.fn().mockResolvedValue(actif),
    verrouillerParIdEtUtilisateur: vi.fn().mockResolvedValue(actif),
  };
  const transactions = {
    listerParActifEtUtilisateur: vi.fn().mockResolvedValue(historique),
    creer: vi.fn().mockImplementation(async (donnees) => ({ id: 42, ...donnees })),
    supprimer: vi.fn().mockResolvedValue(true),
  };
  const dansTransaction = vi.fn(async (operation) => operation(executer));

  return {
    service: creerServiceTransaction({ actifs, transactions, dansTransaction }),
    actifs,
    transactions,
    dansTransaction,
    executer,
  };
}

function mouvement(sens, quantite, prixUnitaire, frais = '0', date = '2026-08-24T10:00:00.000Z') {
  return {
    sens,
    quantite,
    prix_unitaire: prixUnitaire,
    frais,
    date_transaction: date,
  };
}

describe('enregistrement', () => {
  it('écrit un achat sans charger l\'historique, qui n\'a rien à contrôler', async () => {
    const { service, actifs, transactions, dansTransaction } = monter();

    await service.enregistrer({
      actifId: 7,
      utilisateurId: 2,
      donnees: mouvement('achat', '0.1', '60000.00'),
    });

    expect(transactions.creer).toHaveBeenCalledTimes(1);
    expect(transactions.listerParActifEtUtilisateur).not.toHaveBeenCalled();
    expect(actifs.verrouillerParIdEtUtilisateur).toHaveBeenCalledTimes(1);
    expect(dansTransaction).toHaveBeenCalledTimes(1);
  });

  it('refuse une vente supérieure à la quantité détenue', async () => {
    const { service, transactions } = monter();

    await expect(
      service.enregistrer({
        actifId: 7,
        utilisateurId: 2,
        donnees: mouvement('vente', '0.9', '63000.00'),
      })
    ).rejects.toMatchObject({ statut: 400 });

    expect(transactions.creer).not.toHaveBeenCalled();
  });

  it('refuse une vente antérieure au premier achat', async () => {
    const { service, transactions } = monter({
      historique: [
        {
          ...HISTORIQUE[0],
          id: 1,
          quantite: '1.00000000',
          date_transaction: '2026-05-27T10:00:00.000Z',
        },
      ],
    });

    await expect(
      service.enregistrer({
        actifId: 7,
        utilisateurId: 2,
        donnees: mouvement('vente', '1', '63000.00', '0', '2026-05-26T10:00:00.000Z'),
      })
    ).rejects.toMatchObject({ statut: 400 });

    expect(transactions.creer).not.toHaveBeenCalled();
  });

  // Un actif appartenant à un autre compte est indiscernable d'un actif inexistant :
  // le modèle filtre sur le propriétaire, le service ne voit qu'une absence (D52).
  it('rend 404 sur un actif qui n\'appartient pas au demandeur', async () => {
    const { service, transactions } = monter({ actif: null });

    await expect(
      service.enregistrer({
        actifId: 7,
        utilisateurId: 99,
        donnees: mouvement('achat', '0.1', '60000.00'),
      })
    ).rejects.toMatchObject({ statut: 404 });

    expect(transactions.creer).not.toHaveBeenCalled();
    expect(transactions.listerParActifEtUtilisateur).not.toHaveBeenCalled();
  });
});

describe('simulation', () => {
  it('n\'écrit rien', async () => {
    const { service, transactions } = monter();

    await service.simuler({
      actifId: 7,
      utilisateurId: 2,
      donnees: mouvement('achat', '0.2', '58900.00', '2.40'),
    });

    expect(transactions.creer).not.toHaveBeenCalled();
  });

  it('chiffre le déplacement du prix de revient provoqué par un achat', async () => {
    const { service } = monter();

    const effet = await service.simuler({
      actifId: 7,
      utilisateurId: 2,
      donnees: mouvement('achat', '0.2', '58900.00', '2.40'),
    });

    // (45 325 + 58 900 × 0,2 + 2,40) / 1 = 57 107,40
    expect(effet.pru_avant).toBe('56656.25');
    expect(effet.pru_apres).toBe('57107.4');
    expect(effet.effet_pru).toBe('451.15');
    expect(effet.quantite_detenue_avant).toBe('0.8');
    expect(effet.quantite_detenue_apres).toBe('1');
    expect(effet.montant).toBe('11780.00');
    expect(effet.plus_value_realisee).toBeNull();
  });

  // Règle 3 : une vente ne déplace pas le prix de revient. Le récapitulatif doit le
  // montrer par un effet nul, et non taire l'information.
  it('laisse le prix de revient intact sur une vente et chiffre sa plus-value', async () => {
    const { service } = monter();

    const effet = await service.simuler({
      actifId: 7,
      utilisateurId: 2,
      donnees: mouvement('vente', '0.2', '63500.00', '8.00'),
    });

    // 0,2 × (63 500 − 56 656,25) − 8 = 1 360,75
    expect(effet.pru_apres).toBe('56656.25');
    expect(effet.effet_pru).toBe('0');
    expect(effet.quantite_detenue_apres).toBe('0.6');
    expect(effet.plus_value_realisee).toBe('1360.75');
  });

  // Règle 5 : une vente totale solde la position et remet le prix de revient à zéro.
  it('montre la remise à zéro du prix de revient sur une vente totale', async () => {
    const { service } = monter();

    const effet = await service.simuler({
      actifId: 7,
      utilisateurId: 2,
      donnees: mouvement('vente', '0.8', '63500.00'),
    });

    expect(effet.quantite_detenue_apres).toBe('0');
    expect(effet.pru_apres).toBe('0');
    expect(effet.effet_pru).toBe('-56656.25');
  });

  it('applique la règle de vente avant de calculer quoi que ce soit', async () => {
    const { service } = monter();

    await expect(
      service.simuler({
        actifId: 7,
        utilisateurId: 2,
        donnees: mouvement('vente', '0.80000001', '63500.00'),
      })
    ).rejects.toMatchObject({ statut: 400 });
  });

  // Règle 6 : le calcul suit l'ordre chronologique, pas l'ordre de saisie. Un achat
  // rétroactif doit donc donner le même prix de revient que s'il avait été saisi à sa
  // date, et l'effet annoncé porte sur l'état final de la position.
  it('replace une saisie rétroactive à sa date dans le déroulé', async () => {
    const { service } = monter();

    const retroactif = await service.simuler({
      actifId: 7,
      utilisateurId: 2,
      donnees: mouvement('achat', '0.2', '58900.00', '2.40', '2026-06-15T10:00:00.000Z'),
    });
    const courant = await service.simuler({
      actifId: 7,
      utilisateurId: 2,
      donnees: mouvement('achat', '0.2', '58900.00', '2.40'),
    });

    // Le prix de revient est une moyenne pondérée : l'ordre des achats ne le change
    // pas, seule leur composition compte.
    expect(retroactif.pru_apres).toBe(courant.pru_apres);
    expect(retroactif.quantite_detenue_apres).toBe('1');
  });

  it('part d\'un prix de revient nul sur une position encore vide', async () => {
    const { service } = monter({ historique: [] });

    const effet = await service.simuler({
      actifId: 7,
      utilisateurId: 2,
      donnees: mouvement('achat', '0.5', '54000.00', '15.00'),
    });

    expect(effet.pru_avant).toBe('0');
    expect(effet.pru_apres).toBe('54030');
    expect(effet.quantite_detenue_avant).toBe('0');
  });

  it('rend 404 sur un actif qui n\'appartient pas au demandeur', async () => {
    const { service } = monter({ actif: null });

    await expect(
      service.simuler({
        actifId: 7,
        utilisateurId: 99,
        donnees: mouvement('achat', '0.1', '60000.00'),
      })
    ).rejects.toMatchObject({ statut: 404 });
  });
});

describe('suppression', () => {
  it('supprime une transaction dans la transaction SQL verrouillée', async () => {
    const { service, actifs, transactions, dansTransaction, executer } = monter();

    await service.supprimer({ actifId: 7, idTransaction: 2, utilisateurId: 2 });

    expect(dansTransaction).toHaveBeenCalledTimes(1);
    expect(actifs.verrouillerParIdEtUtilisateur).toHaveBeenCalledWith(7, 2, executer);
    expect(transactions.listerParActifEtUtilisateur).toHaveBeenCalledWith(7, 2, executer);
    expect(transactions.supprimer).toHaveBeenCalledWith(2, 7, 2, executer);
  });

  it('refuse de supprimer un achat qui rendrait une vente ultérieure impossible', async () => {
    const { service, transactions } = monter({
      historique: [
        {
          id: 1,
          sens: 'achat',
          quantite: '1.00000000',
          prix_unitaire: '100.00',
          frais: '0.00',
          date_transaction: '2026-01-01T10:00:00.000Z',
        },
        {
          id: 2,
          sens: 'vente',
          quantite: '0.80000000',
          prix_unitaire: '120.00',
          frais: '0.00',
          date_transaction: '2026-01-02T10:00:00.000Z',
        },
      ],
    });

    await expect(
      service.supprimer({ actifId: 7, idTransaction: 1, utilisateurId: 2 })
    ).rejects.toMatchObject({ statut: 400 });

    expect(transactions.supprimer).not.toHaveBeenCalled();
  });

  // Le refus emprunte l'invariant de la création, mais pas son message : « quantité
  // insuffisante » est écrit pour la saisie d'une vente et ne veut rien dire en réponse
  // au retrait d'un achat.
  it('motive le refus par le retrait, et non par la quantité saisie', async () => {
    const { service } = monter({
      historique: [
        {
          id: 1,
          sens: 'achat',
          quantite: '1.00000000',
          prix_unitaire: '100.00',
          frais: '0.00',
          date_transaction: '2026-01-01T10:00:00.000Z',
        },
        {
          id: 2,
          sens: 'vente',
          quantite: '0.80000000',
          prix_unitaire: '120.00',
          frais: '0.00',
          date_transaction: '2026-01-02T10:00:00.000Z',
        },
      ],
    });

    const erreur = await service
      .supprimer({ actifId: 7, idTransaction: 1, utilisateurId: 2 })
      .then(() => null, (echec) => echec);

    expect(erreur.statut).toBe(400);
    expect(erreur.message).toMatch(/ne peut pas être retiré/);
    expect(erreur.message).not.toMatch(/Quantité insuffisante/);
  });

  it('rend 404 lorsque la transaction ne correspond à aucune ligne du compte', async () => {
    const { service, transactions } = monter();
    transactions.supprimer.mockResolvedValue(false);

    await expect(
      service.supprimer({ actifId: 7, idTransaction: 3, utilisateurId: 2 })
    ).rejects.toMatchObject({ statut: 404 });

    expect(transactions.supprimer).not.toHaveBeenCalled();
  });

  it('rend 404 sans lire l\'historique quand l\'actif n\'appartient pas au demandeur', async () => {
    const { service, transactions } = monter({ actif: null });

    await expect(
      service.supprimer({ actifId: 7, idTransaction: 2, utilisateurId: 99 })
    ).rejects.toMatchObject({ statut: 404 });

    expect(transactions.listerParActifEtUtilisateur).not.toHaveBeenCalled();
    expect(transactions.supprimer).not.toHaveBeenCalled();
  });
});
