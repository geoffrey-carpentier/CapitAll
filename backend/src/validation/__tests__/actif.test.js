import { describe, it, expect } from 'vitest';
import { creationActif, modificationActif } from '../actif.js';

describe("schéma de création d'un actif", () => {
  const actifValide = { type: 'crypto', symbole: 'BTC', nom: 'Bitcoin' };

  it('accepte les quatre types du schéma de base', () => {
    for (const type of ['crypto', 'devise', 'metal', 'action']) {
      expect(creationActif.safeParse({ ...actifValide, type }).success).toBe(true);
    }
  });

  it('rejette un type hors liste', () => {
    expect(creationActif.safeParse({ ...actifValide, type: 'obligation' }).success).toBe(false);
  });

  it('normalise le symbole en majuscules et retire les espaces', () => {
    const resultat = creationActif.parse({ ...actifValide, symbole: '  btc  ' });
    expect(resultat.symbole).toBe('BTC');
  });

  it('rejette un symbole vide', () => {
    expect(creationActif.safeParse({ ...actifValide, symbole: '   ' }).success).toBe(false);
  });

  it('rejette un symbole contenant autre chose que des lettres et des chiffres', () => {
    expect(creationActif.safeParse({ ...actifValide, symbole: 'BT-C' }).success).toBe(false);
  });

  it('rejette un nom vide', () => {
    expect(creationActif.safeParse({ ...actifValide, nom: '' }).success).toBe(false);
  });

  // Le propriétaire vient du jeton : le fournir dans le corps doit échouer, sans quoi
  // un utilisateur pourrait tenter de créer un actif pour le compte d'un autre.
  it("rejette un utilisateur_id injecté dans le corps", () => {
    const resultat = creationActif.safeParse({ ...actifValide, utilisateur_id: 1 });
    expect(resultat.success).toBe(false);
    expect(resultat.error.issues[0].code).toBe('unrecognized_keys');
  });

  it('rejette toute clé inconnue', () => {
    expect(creationActif.safeParse({ ...actifValide, date_ajout: '2026-01-01' }).success).toBe(false);
  });
});

describe("schéma de modification d'un actif", () => {
  it('accepte un nom seul', () => {
    expect(modificationActif.safeParse({ nom: 'Bitcoin' }).success).toBe(true);
  });

  // Le symbole et le type sont figés : les changer rendrait l'historique de
  // transactions incohérent.
  it('rejette une tentative de modification du symbole ou du type', () => {
    expect(modificationActif.safeParse({ nom: 'Bitcoin', symbole: 'ETH' }).success).toBe(false);
    expect(modificationActif.safeParse({ nom: 'Bitcoin', type: 'action' }).success).toBe(false);
  });

  it('rejette un corps vide', () => {
    expect(modificationActif.safeParse({}).success).toBe(false);
  });
});
