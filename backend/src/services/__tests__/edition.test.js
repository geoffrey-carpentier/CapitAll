import { describe, it, expect, vi, beforeAll } from 'vitest';

// Correction d'un mouvement enregistré (D51, révisée par D89).
//
// Ce que ce fichier établit tient en une phrase : corriger un mouvement obéit aux mêmes
// règles que le supprimer, et refuse au même endroit. Ce qu'il n'établit pas, et qu'il
// ne peut pas établir avec des modèles en mémoire, c'est le comportement de deux
// corrections concurrentes — cela vit dans edition.integration.test.js, contre un vrai
// PostgreSQL.

let creerServiceTransaction;

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://utilisateur:secret@localhost:5432/walletwatch';
  process.env.JWT_SECRET = 'd'.repeat(32);
  ({ creerServiceTransaction } = await import('../transaction.js'));
});

const ACTIF = { id: 7, utilisateur_id: 2, type: 'crypto', symbole: 'BTC', nom: 'Bitcoin' };

// Un achat, puis une vente qui en dépend. C'est la situation que D51 rendait
// irréparable : corriger le prix de l'achat imposait de supprimer la vente d'abord.
const ACHAT = {
  id: 1,
  sens: 'achat',
  quantite: '0.5',
  prix_unitaire: '54000',
  frais: '15.00',
  frais_montant: '15.00',
  frais_unite: 'EUR',
  date_transaction: '2026-05-27T10:00:00.000Z',
  note: null,
};

const VENTE = {
  id: 2,
  sens: 'vente',
  quantite: '0.4',
  prix_unitaire: '63500',
  frais: '8.00',
  frais_montant: '8.00',
  frais_unite: 'EUR',
  date_transaction: '2026-07-02T10:00:00.000Z',
  note: null,
};

function monter({ actif = ACTIF, historique = [ACHAT, VENTE] } = {}) {
  const executer = vi.fn();
  const actifs = {
    trouverParIdEtUtilisateur: vi.fn().mockResolvedValue(actif),
    verrouillerParIdEtUtilisateur: vi.fn().mockResolvedValue(actif),
  };
  const transactions = {
    listerParActifEtUtilisateur: vi.fn().mockResolvedValue(historique),
    creer: vi.fn().mockImplementation(async (donnees) => ({ id: 99, ...donnees })),
    mettreAJour: vi.fn().mockImplementation(async (donnees) => ({ ...donnees })),
    supprimer: vi.fn().mockResolvedValue(true),
  };

  return {
    service: creerServiceTransaction({
      actifs,
      transactions,
      dansTransaction: vi.fn(async (operation) => operation(executer)),
    }),
    actifs,
    transactions,
  };
}

function correction(champs) {
  return {
    sens: 'achat',
    quantite: '0.5',
    prix_unitaire: '54000',
    frais: '15.00',
    date_transaction: '2026-05-27T10:00:00.000Z',
    ...champs,
  };
}

describe('correction d’un mouvement (D51 révisée)', () => {
  it('corrige le prix d’un achat sans toucher à la vente qui en dépend', async () => {
    // C'est le cas qui justifie la révision de D51. Avant, il fallait supprimer la
    // vente, corriger l'achat, puis ressaisir la vente — en perdant sa date, sa note et
    // son identité.
    const { service, transactions } = monter();

    const modifiee = await service.modifier({
      actifId: 7,
      idTransaction: 1,
      utilisateurId: 2,
      donnees: correction({ prix_unitaire: '52000' }),
    });

    expect(modifiee.prixUnitaire).toBe('52000');
    expect(transactions.mettreAJour).toHaveBeenCalledTimes(1);
    expect(transactions.supprimer).not.toHaveBeenCalled();
    expect(transactions.creer).not.toHaveBeenCalled();
  });

  it('prend le verrou de l’actif avant de relire l’historique', async () => {
    // L'ordre est la garantie de sérialisation : relire avant de verrouiller
    // reviendrait à valider la correction contre un état déjà périmé.
    const { service, actifs, transactions } = monter();
    const ordre = [];

    actifs.verrouillerParIdEtUtilisateur.mockImplementation(async () => {
      ordre.push('verrou');
      return ACTIF;
    });
    transactions.listerParActifEtUtilisateur.mockImplementation(async () => {
      ordre.push('lecture');
      return [ACHAT, VENTE];
    });

    await service.modifier({
      actifId: 7,
      idTransaction: 1,
      utilisateurId: 2,
      donnees: correction({ prix_unitaire: '52000' }),
    });

    expect(ordre).toEqual(['verrou', 'lecture']);
  });

  it('refuse sans rien écrire une correction qui rend une vente postérieure impossible', async () => {
    const { service, transactions } = monter();

    // L'achat passe de 0,5 à 0,3 alors qu'une vente de 0,4 le suit.
    await expect(
      service.modifier({
        actifId: 7,
        idTransaction: 1,
        utilisateurId: 2,
        donnees: correction({ quantite: '0.3' }),
      })
    ).rejects.toThrow(/mouvement postérieur deviendrait impossible/);

    expect(transactions.mettreAJour).not.toHaveBeenCalled();
  });

  it('nomme la règle quand c’est le mouvement corrigé lui-même qui est en défaut', async () => {
    const { service } = monter();

    // La vente passe de 0,4 à 0,9 alors que 0,5 seulement ont été achetés : le refus
    // porte sur elle, et le message de la règle est le bon.
    await expect(
      service.modifier({
        actifId: 7,
        idTransaction: 2,
        utilisateurId: 2,
        donnees: correction({ sens: 'vente', quantite: '0.9', prix_unitaire: '63500' }),
      })
    ).rejects.toThrow(/Quantité insuffisante/);
  });

  it('rend 404 sur un mouvement inexistant, sans écrire', async () => {
    const { service, transactions } = monter();

    await expect(
      service.modifier({
        actifId: 7,
        idTransaction: 404,
        utilisateurId: 2,
        donnees: correction({}),
      })
    ).rejects.toThrow(/Transaction introuvable/);

    expect(transactions.mettreAJour).not.toHaveBeenCalled();
  });

  it('rend 404 quand l’actif appartient à un autre compte', async () => {
    // Le verrou filtre sur le propriétaire : il ne rend rien, et un actif d'autrui est
    // indiscernable d'un actif inexistant (D52).
    const { service, transactions } = monter();
    const { service: refuse } = monter({ actif: null });

    await expect(
      refuse.modifier({
        actifId: 7,
        idTransaction: 1,
        utilisateurId: 3,
        donnees: correction({}),
      })
    ).rejects.toThrow(/Transaction introuvable/);

    expect(transactions.mettreAJour).not.toHaveBeenCalled();
    void service;
  });

  it('convertit les frais corrigés comme à la création', async () => {
    const { service } = monter();

    const modifiee = await service.modifier({
      actifId: 7,
      idTransaction: 1,
      utilisateurId: 2,
      donnees: correction({
        quantite: '0.5',
        prix_unitaire: '54000',
        frais: undefined,
        frais_montant: '0.0002',
        frais_unite: 'BTC',
      }),
    });

    // 0,0002 x 54 000 = 10,80 euros.
    expect(modifiee.frais).toBe('10.80');
    expect(modifiee.fraisMontant).toBe('0.0002');
    expect(modifiee.fraisUnite).toBe('BTC');
  });

  it('efface le prix quand un mouvement devient une sortie non marchande', async () => {
    const { service } = monter();

    const modifiee = await service.modifier({
      actifId: 7,
      idTransaction: 2,
      utilisateurId: 2,
      donnees: correction({ sens: 'sortie_non_marchande', quantite: '0.4', prix_unitaire: undefined }),
    });

    expect(modifiee.sens).toBe('sortie_non_marchande');
    expect(modifiee.prixUnitaire).toBe('0');
  });
});

describe('simulation d’une correction', () => {
  it('compare la position d’aujourd’hui à celle qu’aurait produite la correction', async () => {
    const { service } = monter();

    // Achat 0,5 à 54 000 avec 15 de frais, vente de 0,4 : il reste 0,1 au prix de
    // revient de 54 030. Corriger le prix d'achat à 52 000 le ramène à 52 030.
    const effet = await service.simuler({
      actifId: 7,
      idTransaction: 1,
      utilisateurId: 2,
      donnees: correction({ prix_unitaire: '52000' }),
    });

    expect(effet.pru_avant).toBe('54030');
    expect(effet.pru_apres).toBe('52030');
    expect(effet.effet_pru).toBe('-2000');
    expect(effet.quantite_detenue_avant).toBe('0.1');
    expect(effet.quantite_detenue_apres).toBe('0.1');
  });

  it('rend la plus-value recalculée du mouvement corrigé lui-même', async () => {
    const { service } = monter();

    // La vente de 0,4 passe de 63 500 à 65 000 : 0,4 x (65 000 − 54 030) − 8.
    const effet = await service.simuler({
      actifId: 7,
      idTransaction: 2,
      utilisateurId: 2,
      donnees: correction({ sens: 'vente', quantite: '0.4', prix_unitaire: '65000', frais: '8.00' }),
    });

    expect(effet.plus_value_realisee).toBe('4380.00');
  });

  it('refuse la simulation d’une correction impossible, comme l’enregistrement', async () => {
    const { service } = monter();

    await expect(
      service.simuler({
        actifId: 7,
        idTransaction: 1,
        utilisateurId: 2,
        donnees: correction({ quantite: '0.3' }),
      })
    ).rejects.toThrow(/mouvement postérieur deviendrait impossible/);
  });

  it('rend 404 sur la simulation d’un mouvement inexistant', async () => {
    const { service } = monter();

    await expect(
      service.simuler({
        actifId: 7,
        idTransaction: 404,
        utilisateurId: 2,
        donnees: correction({}),
      })
    ).rejects.toThrow(/Transaction introuvable/);
  });

  it('reste une création quand aucun identifiant n’est donné', async () => {
    const { service } = monter();

    const effet = await service.simuler({
      actifId: 7,
      utilisateurId: 2,
      donnees: correction({ quantite: '0.2', prix_unitaire: '60000', frais: '0' }),
    });

    // Le mouvement s'ajoute : la quantité détenue passe de 0,1 à 0,3.
    expect(effet.quantite_detenue_avant).toBe('0.1');
    expect(effet.quantite_detenue_apres).toBe('0.3');
  });
});
