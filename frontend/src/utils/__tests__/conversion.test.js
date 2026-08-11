import { describe, it, expect } from 'vitest';
import { convertir } from '../conversion';

describe('conversion à l\'affichage', () => {
  it('applique le taux et rend un montant au centime', () => {
    expect(convertir('100.00', '1.1364')).toBe('113.64');
    expect(convertir('12480.65', '1.1364')).toBe('14183.01');
  });

  it('conserve toute la précision du taux transmis', () => {
    expect(convertir('1000.00', '1.138952164009')).toBe('1138.95');
  });

  it('traite les montants négatifs sans dériver sur le signe', () => {
    expect(convertir('-135.51', '1.1364')).toBe('-153.99');
  });

  it('rend zéro pour un montant nul', () => {
    expect(convertir('0.00', '1.1364')).toBe('0');
  });

  // Même règle d'arrondi que le serveur : au plus proche, les demis s'éloignant de zéro.
  // Deux règles différentes dans une même application produiraient des écarts d'un
  // centime que personne ne saurait expliquer.
  it('arrondit les demis en s\'éloignant de zéro', () => {
    expect(convertir('0.05', '1.5')).toBe('0.08');
    expect(convertir('-0.05', '1.5')).toBe('-0.08');
  });

  // Le cœur de la règle de non-conversion. Sur ces deux valeurs, le produit flottant
  // tombe juste sous le demi-centime et s'arrondit vers le bas : 1,15 x 1,5 donne
  // 1,7249999999999999 au lieu de 1,725, soit 1,72 au lieu de 1,73. Un centime perdu
  // par montant, sur une bascule qui s'applique à tout l'écran.
  it('rend un résultat que le flottant fausserait au centime', () => {
    expect(convertir('1.15', '1.5')).toBe('1.73');
    expect(convertir('2.05', '1.5')).toBe('3.08');
  });

  it('rend fidèlement des valeurs que le flottant représente mal', () => {
    expect(convertir('0.10', '3')).toBe('0.3');
    expect(convertir('8.70', '100')).toBe('870');
  });

  it('refuse une entrée qui n\'est pas une chaîne décimale', () => {
    expect(convertir('abc', '1.1364')).toBeNull();
    expect(convertir('100.00', 'abc')).toBeNull();
    expect(convertir(null, '1.1364')).toBeNull();
    expect(convertir('100.00', null)).toBeNull();
    expect(convertir(100, '1.1364')).toBeNull();
  });
});
