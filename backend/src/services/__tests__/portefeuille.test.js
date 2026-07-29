import { describe, it, expect } from 'vitest';
import { quantiteDetenue, verifierVenteAutorisee } from '../portefeuille.js';

function achat(quantite) {
  return { sens: 'achat', quantite };
}

function vente(quantite) {
  return { sens: 'vente', quantite };
}

describe('quantité détenue', () => {
  it('rend 0 sur un portefeuille sans transaction', () => {
    expect(quantiteDetenue([])).toBe('0');
  });

  it('additionne les achats', () => {
    expect(quantiteDetenue([achat('0.5'), achat('0.3'), achat('1.2')])).toBe('2');
  });

  it('soustrait les ventes', () => {
    expect(quantiteDetenue([achat('0.5'), achat('0.3'), vente('0.2')])).toBe('0.6');
  });

  it('rend une quantité négative si les ventes dépassent les achats', () => {
    expect(quantiteDetenue([achat('1'), vente('1.5')])).toBe('-0.5');
  });

  // En arithmétique flottante, 0.1 + 0.2 vaut 0.30000000000000004 : l'accumulation en
  // entiers de la plus petite unité doit rendre exactement 0.3.
  it('reste exact là où le calcul flottant dérive', () => {
    expect(quantiteDetenue([achat('0.1'), achat('0.2')])).toBe('0.3');
  });

  it('reste exact sur des quantités à 8 décimales', () => {
    expect(quantiteDetenue([achat('0.00000001'), achat('0.00000002')])).toBe('0.00000003');
    expect(quantiteDetenue([achat('1.00000001'), vente('0.00000001')])).toBe('1');
  });

  it('accepte des quantités fournies en nombre comme en chaîne', () => {
    expect(quantiteDetenue([achat(0.5), achat('0.25')])).toBe('0.75');
  });
});

describe('règle de vente', () => {
  const historique = [achat('1.5'), vente('0.5')];

  it('accepte une vente inférieure à la quantité détenue', () => {
    expect(() => verifierVenteAutorisee(historique, '0.4')).not.toThrow();
  });

  it('accepte une vente égale à la quantité détenue', () => {
    expect(() => verifierVenteAutorisee(historique, '1')).not.toThrow();
  });

  it('refuse une vente supérieure à la quantité détenue', () => {
    expect(() => verifierVenteAutorisee(historique, '1.00000001')).toThrow();
  });

  it('indique la quantité disponible dans le message', () => {
    expect(() => verifierVenteAutorisee(historique, '2')).toThrow(/1(\D|$)/);
  });

  it('refuse toute vente sur un portefeuille vide', () => {
    expect(() => verifierVenteAutorisee([], '0.00000001')).toThrow();
  });

  it('lève une erreur portant le statut 400', () => {
    try {
      verifierVenteAutorisee(historique, '99');
      throw new Error('une erreur était attendue');
    } catch (erreur) {
      expect(erreur.statut).toBe(400);
    }
  });
});
