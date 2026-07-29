import { describe, it, expect } from 'vitest';
import { creationTransaction } from '../transaction.js';

const HIER = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

const transactionValide = {
  sens: 'achat',
  quantite: '0.5',
  prix_unitaire: '54000.00',
  date_transaction: HIER,
};

describe('schéma de création d\'une transaction', () => {
  it('accepte une transaction bien formée', () => {
    expect(creationTransaction.safeParse(transactionValide).success).toBe(true);
  });

  it('applique 0 comme montant de frais par défaut', () => {
    const resultat = creationTransaction.parse(transactionValide);
    expect(resultat.frais).toBe('0');
  });

  it('rejette un sens hors liste', () => {
    expect(creationTransaction.safeParse({ ...transactionValide, sens: 'don' }).success).toBe(false);
  });

  it('rejette une quantité nulle', () => {
    expect(creationTransaction.safeParse({ ...transactionValide, quantite: '0' }).success).toBe(false);
  });

  it('rejette une quantité négative', () => {
    expect(creationTransaction.safeParse({ ...transactionValide, quantite: '-1' }).success).toBe(false);
  });

  it('rejette un prix unitaire négatif', () => {
    expect(
      creationTransaction.safeParse({ ...transactionValide, prix_unitaire: '-0.01' }).success
    ).toBe(false);
  });

  it('accepte un prix unitaire nul', () => {
    expect(
      creationTransaction.safeParse({ ...transactionValide, prix_unitaire: '0' }).success
    ).toBe(true);
  });

  it('accepte une quantité à 8 décimales', () => {
    expect(
      creationTransaction.safeParse({ ...transactionValide, quantite: '0.00000001' }).success
    ).toBe(true);
  });

  it('rejette une quantité à plus de 8 décimales', () => {
    expect(
      creationTransaction.safeParse({ ...transactionValide, quantite: '0.000000001' }).success
    ).toBe(false);
  });

  it('rejette un prix unitaire à plus de 2 décimales', () => {
    expect(
      creationTransaction.safeParse({ ...transactionValide, prix_unitaire: '10.123' }).success
    ).toBe(false);
  });

  it('conserve la quantité sous forme de chaîne, sans conversion en flottant', () => {
    const resultat = creationTransaction.parse({ ...transactionValide, quantite: 0.1 });
    expect(resultat.quantite).toBe('0.1');
    expect(typeof resultat.quantite).toBe('string');
  });

  it('rejette une date de transaction dans le futur', () => {
    const demain = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    expect(
      creationTransaction.safeParse({ ...transactionValide, date_transaction: demain }).success
    ).toBe(false);
  });

  it('rejette une date de transaction invalide', () => {
    expect(
      creationTransaction.safeParse({ ...transactionValide, date_transaction: 'hier' }).success
    ).toBe(false);
  });

  // actif_id vient de l'URL, le propriétaire du jeton : ni l'un ni l'autre n'est
  // accepté depuis le corps de la requête.
  it("rejette un actif_id ou un utilisateur_id injecté dans le corps", () => {
    expect(creationTransaction.safeParse({ ...transactionValide, actif_id: 1 }).success).toBe(false);
    expect(
      creationTransaction.safeParse({ ...transactionValide, utilisateur_id: 1 }).success
    ).toBe(false);
  });
});
