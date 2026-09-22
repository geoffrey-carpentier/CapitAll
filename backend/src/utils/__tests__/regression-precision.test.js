import { describe, it, expect, beforeAll } from 'vitest';

// Précision numérique : chaque test décrit une perte de précision réelle, et échouerait
// si une échelle était rabaissée par mégarde.

let versUnites;
let versNotationPositionnelle;
let ECHELLE_QUANTITE;
let ECHELLE_PRU;
let derouler;
let valoriser;
let calculerPerformances;
let creationTransaction;

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://utilisateur:secret@localhost:5432/capitall';
  process.env.JWT_SECRET = 'f'.repeat(32);
  ({ versUnites, versNotationPositionnelle, ECHELLE_QUANTITE, ECHELLE_PRU } = await import(
    '../decimal.js'
  ));
  ({ derouler, valoriser, calculerPerformances } = await import(
    '../../services/calculPortefeuille.js'
  ));
  ({ creationTransaction } = await import('../../validation/transaction.js'));
});

const ACHAT_SUB_CENTIME = {
  id: 1,
  sens: 'achat',
  quantite: '5000000',
  prix_unitaire: '0.0000123',
  frais: '0',
  date_transaction: '2026-01-01T12:00:00Z',
};

describe('achat à prix unitaire sous le centime', () => {
  it('rend un coût de 61,50 € pour 5 000 000 unités à 0,0000123 €', () => {
    const { position } = derouler([ACHAT_SUB_CENTIME]);

    expect(position.cout_total).toBe('61.50');
    // Sans frais, le prix de revient unitaire est le prix payé.
    expect(position.pru).toBe('0.0000123');
  });

  it('accepte le prix à la validation', () => {
    const { id: _id, ...entree } = ACHAT_SUB_CENTIME;
    expect(creationTransaction.safeParse(entree).success).toBe(true);
  });

  it('conserve le montant de chaque mouvement', () => {
    const { mouvements } = derouler([ACHAT_SUB_CENTIME]);
    expect(mouvements[0].montant).toBe('61.50');
  });
});

describe('performance sur des cours sous le centime', () => {
  const SERIE = [
    { date_snapshot: '2026-01-01', cours_eur: '0.0000123' },
    { date_snapshot: '2026-01-02', cours_eur: '0.0000246' },
  ];

  it('rend +100 % quand le cours double', () => {
    expect(calculerPerformances(SERIE, 'cours_eur').jour).toBe('100.00');
  });

  it("lit la valeur d'un patrimoine à l'échelle des montants", () => {
    // La même mécanique sert deux séries de natures différentes : le cours descend sous
    // le centime, la valeur d'un patrimoine s'y arrête.
    const patrimoine = [
      { date_snapshot: '2026-01-01', valeur_totale_eur: '1000.00' },
      { date_snapshot: '2026-01-02', valeur_totale_eur: '1100.00' },
    ];
    expect(calculerPerformances(patrimoine).jour).toBe('10.00');
  });
});

describe('valorisation sous l\'ancienne échelle interne', () => {
  it('valorise 10 000 000 unités à 0,0000000012 € à 0,01 €', () => {
    // Produit exact : 0,012 €, soit 0,01 € au centime le plus proche.
    const position = {
      quantite_detenue: '10000000',
      pru: '0',
      cout_total: '0.00',
      plus_value_realisee: '0.00',
    };

    expect(valoriser(position, '0.0000000012').valeur).toBe('0.01');
  });
});

describe('bornes hautes concordantes avec les colonnes', () => {
  function transaction(prix) {
    return {
      sens: 'achat',
      quantite: '1',
      prix_unitaire: prix,
      frais: '0',
      date_transaction: '2026-01-01T12:00:00Z',
    };
  }

  it('refuse un prix dépassant la capacité de la colonne', () => {
    // Mesuré sur PostgreSQL 16 : cette valeur est refusée par « numeric field overflow »
    // (SQLSTATE 22003). Sans borne applicative, la requête partait et l'utilisateur
    // recevait une erreur serveur au lieu d'un refus de saisie.
    expect(creationTransaction.safeParse(transaction('99999999999999999.99')).success).toBe(false);
  });

  it('accepte un prix dans les bornes', () => {
    expect(creationTransaction.safeParse(transaction('999999999.99')).success).toBe(true);
  });
});

describe('notation scientifique', () => {
  // JavaScript écrit en exposant tout nombre inférieur à 1e-6, et JSON.parse rend un
  // nombre : la notation scientifique doit être acceptée.
  it('convertit une valeur exponentielle sans lever', () => {
    expect(() => versUnites('1e-12', 18)).not.toThrow();
    expect(() => versUnites('1.23e-9', 18)).not.toThrow();
    expect(() => versUnites('3.4E+5', 18)).not.toThrow();
  });

  it('rend la même valeur que son écriture positionnelle', () => {
    expect(versUnites('1e-12', 18)).toBe(versUnites('0.000000000001', 18));
    expect(versUnites('1.23e-9', 18)).toBe(versUnites('0.00000000123', 18));
    expect(versUnites('3.4E+5', 18)).toBe(versUnites('340000', 18));
    expect(versUnites('-1.5e-3', 18)).toBe(versUnites('-0.0015', 18));
  });

  it('laisse intacte une écriture déjà positionnelle', () => {
    expect(versNotationPositionnelle('88123.4567891')).toBe('88123.4567891');
    expect(versNotationPositionnelle('-0.5')).toBe('-0.5');
  });

  it('accepte un prix exponentiel à la validation', () => {
    // Un client envoyant 0.0000001 en JSON transmet un nombre, que JavaScript restitue
    // « 1e-7 ». Le motif de validation l'aurait rejeté comme malformé.
    const resultat = creationTransaction.safeParse({
      sens: 'achat',
      quantite: '1',
      prix_unitaire: 0.0000001,
      frais: '0',
      date_transaction: '2026-01-01T12:00:00Z',
    });

    expect(resultat.success).toBe(true);
    expect(resultat.data.prix_unitaire).toBe('0.0000001');
  });
});

describe('échelles explicites', () => {
  it('tient le prix de revient à une échelle supérieure à celle des quantités', () => {
    // Le PRU peut porter plus de décimales que les quantités sans fausser les produits.
    expect(ECHELLE_PRU).toBeGreaterThan(ECHELLE_QUANTITE);
  });

  it('conserve le résultat exact sur une position construite par petits achats', () => {
    // Mille achats d'un centième d'unité à un euro : le prix de revient doit valoir
    // exactement un euro, sans dérive d'arrondi accumulée.
    const mouvements = Array.from({ length: 1000 }, (_, index) => ({
      id: index + 1,
      sens: 'achat',
      quantite: '0.01',
      prix_unitaire: '1',
      frais: '0',
      date_transaction: `2026-01-01T12:00:00Z`,
    }));

    const { position } = derouler(mouvements);

    expect(position.quantite_detenue).toBe('10');
    expect(position.pru).toBe('1');
    expect(position.cout_total).toBe('10.00');
  });
});
