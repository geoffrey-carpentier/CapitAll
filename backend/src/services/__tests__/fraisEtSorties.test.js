import { describe, it, expect, vi, beforeAll } from 'vitest';
import { derouler, consolider, valoriser } from '../calculPortefeuille.js';

// Frais dans leur unité d'origine et sorties non marchandes (D89).
//
// Ce fichier reprend, au chiffre près, les trois exemples sur lesquels le modèle a été
// arbitré, puis les règles propres à un mouvement qui n'est pas une vente. Il existe
// pour une raison précise : la faute que ce lot doit rendre impossible est un double
// comptage, et un double comptage ne se voit pas à la relecture du code. Il se voit sur
// un total qui ne tombe pas juste.

let creerServiceTransaction;

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://utilisateur:secret@localhost:5432/walletwatch';
  process.env.JWT_SECRET = 'd'.repeat(32);
  ({ creerServiceTransaction } = await import('../transaction.js'));
});

const ETH = { id: 3, utilisateur_id: 2, type: 'crypto', symbole: 'ETH', nom: 'Ethereum' };

function monter({ actif = ETH, historique = [] } = {}) {
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

  return {
    service: creerServiceTransaction({
      actifs,
      transactions,
      dansTransaction: vi.fn(async (operation) => operation(executer)),
    }),
    transactions,
  };
}

const HIER = '2026-09-04T10:00:00.000Z';

describe('frais dans leur unité de prélèvement (D89)', () => {
  it('laisse un achat à frais en euros exactement tel qu’avant', async () => {
    // Le premier acquis du lot est une non-régression : le modèle nouveau doit rendre,
    // sur le cas courant, le chiffre que rendait le modèle ancien. Achat de 0,5 BTC à
    // 60 000 euros, 15 euros de frais : coût 30 015, prix de revient 60 030.
    const { service, transactions } = monter();

    const enregistre = await service.enregistrer({
      actifId: 3,
      utilisateurId: 2,
      donnees: {
        sens: 'achat',
        quantite: '0.5',
        prix_unitaire: '60000',
        frais: '15.00',
        date_transaction: HIER,
      },
    });

    expect(enregistre.frais).toBe('15.00');
    expect(enregistre.fraisMontant).toBe('15.00');
    expect(enregistre.fraisUnite).toBe('EUR');

    const { position } = derouler([
      {
        id: 1,
        sens: 'achat',
        quantite: '0.5',
        prix_unitaire: '60000',
        frais: '15.00',
        date_transaction: HIER,
      },
    ]);

    expect(position.cout_total).toBe('30015.00');
    expect(position.pru).toBe('60030');
    expect(transactions.creer).toHaveBeenCalledTimes(1);
  });

  it('convertit des frais prélevés dans l’actif acheté au prix de l’opération', async () => {
    // Ordre de 1 000 euros d'ETH à 2 500 euros l'unité, 0,002 ETH retenus par la
    // plateforme : 0,398 ETH sont reçus, et c'est cette quantité-là qui est détenue.
    // Les frais valent 0,002 x 2 500 = 5,00 euros, et le coût retombe sur les 1 000
    // euros effectivement dépensés.
    const { service } = monter();

    const enregistre = await service.enregistrer({
      actifId: 3,
      utilisateurId: 2,
      donnees: {
        sens: 'achat',
        quantite: '0.398',
        prix_unitaire: '2500',
        frais_montant: '0.002',
        frais_unite: 'ETH',
        date_transaction: HIER,
      },
    });

    expect(enregistre.frais).toBe('5.00');
    expect(enregistre.fraisMontant).toBe('0.002');
    expect(enregistre.fraisUnite).toBe('ETH');

    const { position } = derouler([
      {
        id: 1,
        sens: 'achat',
        quantite: '0.398',
        prix_unitaire: '2500',
        frais: '5.00',
        date_transaction: HIER,
      },
    ]);

    expect(position.quantite_detenue).toBe('0.398');
    expect(position.cout_total).toBe('1000.00');
    // 1 000 / 0,398 : le quotient est illimité, l'échelle du prix de revient le fixe.
    expect(position.pru.startsWith('2512.5628140703517587939698')).toBe(true);
  });

  it('exige la contre-valeur en euros de frais prélevés dans un tiers actif', async () => {
    const { service } = monter();

    // Aucun taux ne se lit dans le mouvement : le déduire du prix de l'ETH reviendrait
    // à traiter 0,01 BNB comme 0,01 ETH. Le refus nomme le champ à remplir.
    await expect(
      service.enregistrer({
        actifId: 3,
        utilisateurId: 2,
        donnees: {
          sens: 'achat',
          quantite: '0.4',
          prix_unitaire: '2500',
          frais_montant: '0.01',
          frais_unite: 'BNB',
          date_transaction: HIER,
        },
      })
    ).rejects.toThrow(/contre-valeur en euros/i);
  });

  it('reprend la contre-valeur saisie pour des frais en tiers actif', async () => {
    const { service } = monter();

    const enregistre = await service.enregistrer({
      actifId: 3,
      utilisateurId: 2,
      donnees: {
        sens: 'achat',
        quantite: '0.4',
        prix_unitaire: '2500',
        frais_montant: '0.01',
        frais_unite: 'BNB',
        frais_contre_valeur_eur: '5.20',
        date_transaction: HIER,
      },
    });

    expect(enregistre.frais).toBe('5.20');
    expect(enregistre.fraisUnite).toBe('BNB');

    const { position } = derouler([
      {
        id: 1,
        sens: 'achat',
        quantite: '0.4',
        prix_unitaire: '2500',
        frais: '5.20',
        date_transaction: HIER,
      },
    ]);

    expect(position.cout_total).toBe('1005.20');
  });

  it('ramène l’absence de frais à zéro euro sans rien inventer', async () => {
    const { service } = monter();

    const enregistre = await service.enregistrer({
      actifId: 3,
      utilisateurId: 2,
      donnees: {
        sens: 'achat',
        quantite: '1',
        prix_unitaire: '2500',
        date_transaction: HIER,
      },
    });

    expect(enregistre.frais).toBe('0');
    expect(enregistre.fraisMontant).toBe('0');
    expect(enregistre.fraisUnite).toBe('EUR');
  });

  it('conserve une quantité de frais que deux décimales auraient effacée', async () => {
    // 0,000021 ETH est un prélèvement réseau ordinaire. Stocké au centime, il vaudrait
    // zéro : c'est le montant prélevé, pas sa contre-valeur, qui a besoin des dix-huit
    // décimales.
    const { service } = monter();

    const enregistre = await service.enregistrer({
      actifId: 3,
      utilisateurId: 2,
      donnees: {
        sens: 'achat',
        quantite: '1',
        prix_unitaire: '2500',
        frais_montant: '0.000021',
        frais_unite: 'ETH',
        date_transaction: HIER,
      },
    });

    expect(enregistre.fraisMontant).toBe('0.000021');
    expect(enregistre.frais).toBe('0.05');
  });
});

describe('sorties non marchandes (D89)', () => {
  const ACHAT = {
    id: 1,
    sens: 'achat',
    quantite: '1',
    prix_unitaire: '2500',
    frais: '0',
    date_transaction: '2026-08-01T10:00:00.000Z',
  };

  const RETRAIT = {
    id: 2,
    sens: 'sortie_non_marchande',
    quantite: '0.002',
    prix_unitaire: '0',
    frais: '0',
    date_transaction: '2026-08-15T10:00:00.000Z',
  };

  it('retire de la quantité sans toucher au prix de revient unitaire', () => {
    const { mouvements, position } = derouler([ACHAT, RETRAIT]);
    const sortie = mouvements.find((m) => m.id === 2);

    expect(position.quantite_detenue).toBe('0.998');
    // Le prix de revient unitaire est celui de l'achat : réduire la quantité réduit le
    // coût restant au prorata, et c'est exactement ce qu'il faut. Le réduire davantage
    // ferait monter le PRU d'un mouvement qui ne l'affecte pas.
    expect(position.pru).toBe('2500');
    expect(sortie.effet_pru).toBe('0');
    expect(position.cout_total).toBe('2495.00');
  });

  it('ne dégage aucune plus-value réalisée', () => {
    const { mouvements, position } = derouler([ACHAT, RETRAIT]);
    const sortie = mouvements.find((m) => m.id === 2);

    // Null et non zéro : la notion ne s'applique pas, et « 0,00 € » laisserait croire à
    // une vente sans gain.
    expect(sortie.plus_value_realisee).toBeNull();
    expect(position.plus_value_realisee).toBe('0.00');
  });

  it('porte la valeur sortie par un résultat distinct', () => {
    const { mouvements, position } = derouler([ACHAT, RETRAIT]);
    const sortie = mouvements.find((m) => m.id === 2);

    // 0,002 x 2 500 = 5,00 euros de coût quittent le portefeuille.
    expect(sortie.cout_sortie).toBe('5.00');
    expect(position.cout_frais_eur).toBe('5.00');
  });

  it('ne produit aucun montant d’opération', () => {
    const { mouvements } = derouler([ACHAT, RETRAIT]);
    const sortie = mouvements.find((m) => m.id === 2);

    // C'est ce champ qui, valorisé, ferait apparaître un transfert comme une vente à
    // zéro euro dans la frise.
    expect(sortie.montant).toBe('0.00');
  });

  it('solde la position et repart d’un prix de revient neuf', () => {
    const total = { ...RETRAIT, quantite: '1' };
    const rachat = {
      id: 3,
      sens: 'achat',
      quantite: '2',
      prix_unitaire: '1800',
      frais: '0',
      date_transaction: '2026-08-20T10:00:00.000Z',
    };

    const { position } = derouler([ACHAT, total, rachat]);

    expect(position.quantite_detenue).toBe('2');
    expect(position.pru).toBe('1800');
    expect(position.cout_frais_eur).toBe('2500.00');
  });

  it('n’entre pas dans la plus-value réalisée consolidée', () => {
    const positionEth = valoriser(derouler([ACHAT, RETRAIT]).position, '2600');
    const consolide = consolider([{ ...positionEth, type: 'crypto' }]);

    expect(consolide.plus_value_realisee).toBe('0.00');
    expect(consolide.cout_frais_eur).toBe('5.00');
  });

  it('refuse de faire sortir plus que ce que la position détient', async () => {
    const { service } = monter({ historique: [ACHAT] });

    await expect(
      service.enregistrer({
        actifId: 3,
        utilisateurId: 2,
        donnees: {
          sens: 'sortie_non_marchande',
          quantite: '2',
          date_transaction: HIER,
        },
      })
    ).rejects.toThrow(/Quantité insuffisante/);
  });

  it('écrit un prix nul même si l’appelant n’en fournit aucun', async () => {
    const { service } = monter({ historique: [ACHAT] });

    const enregistre = await service.enregistrer({
      actifId: 3,
      utilisateurId: 2,
      donnees: {
        sens: 'sortie_non_marchande',
        quantite: '0.1',
        date_transaction: HIER,
      },
    });

    expect(enregistre.sens).toBe('sortie_non_marchande');
    expect(enregistre.prixUnitaire).toBe('0');
  });

  it('refuse des frais prélevés dans l’actif qui sort', async () => {
    // Ils font déjà partie de la quantité retirée : les compter en plus les compterait
    // deux fois, et c'est précisément le défaut que ce lot doit rendre impossible.
    const { service } = monter({ historique: [ACHAT] });

    await expect(
      service.enregistrer({
        actifId: 3,
        utilisateurId: 2,
        donnees: {
          sens: 'sortie_non_marchande',
          quantite: '0.1',
          frais_montant: '0.002',
          frais_unite: 'ETH',
          date_transaction: HIER,
        },
      })
    ).rejects.toThrow(/font partie de la quantité qui sort/);
  });

  it('annonce le coût de la sortie dans le récapitulatif de saisie', async () => {
    const { service } = monter({ historique: [ACHAT] });

    const effet = await service.simuler({
      actifId: 3,
      utilisateurId: 2,
      donnees: {
        sens: 'sortie_non_marchande',
        quantite: '0.002',
        date_transaction: HIER,
      },
    });

    expect(effet.sens).toBe('sortie_non_marchande');
    expect(effet.montant).toBe('0.00');
    expect(effet.plus_value_realisee).toBeNull();
    expect(effet.cout_sortie).toBe('5.00');
    expect(effet.quantite_detenue_apres).toBe('0.998');
  });
});
