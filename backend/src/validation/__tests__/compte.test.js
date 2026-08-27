import { describe, it, expect } from 'vitest';
import { schemaChangementMotDePasse } from '../compte.js';

function valider(donnees) {
  return schemaChangementMotDePasse.safeParse(donnees);
}

const VALIDE = { ancienMotDePasse: 'ancien-solide', nouveauMotDePasse: 'nouveau-solide' };

describe('changement de mot de passe (E7)', () => {
  it('accepte un couple valide', () => {
    expect(valider(VALIDE).success).toBe(true);
  });

  it('refuse un nouveau mot de passe trop court', () => {
    const resultat = valider({ ...VALIDE, nouveauMotDePasse: 'court' });

    expect(resultat.success).toBe(false);
    expect(resultat.error.issues[0].path).toEqual(['nouveauMotDePasse']);
  });

  it('refuse un ancien mot de passe vide', () => {
    const resultat = valider({ ...VALIDE, ancienMotDePasse: '' });

    expect(resultat.success).toBe(false);
    expect(resultat.error.issues[0].path).toEqual(['ancienMotDePasse']);
  });

  // Un mot de passe court reste acceptable en ancien : la règle de longueur a pu être
  // durcie depuis la création du compte, et l'utilisateur doit pouvoir le corriger.
  it("n'impose pas la longueur minimale à l'ancien mot de passe", () => {
    expect(valider({ ...VALIDE, ancienMotDePasse: 'court' }).success).toBe(true);
  });

  it('refuse un nouveau mot de passe identique à l’ancien', () => {
    const resultat = valider({ ancienMotDePasse: 'meme-mot-de-passe', nouveauMotDePasse: 'meme-mot-de-passe' });

    expect(resultat.success).toBe(false);
    expect(resultat.error.issues[0].path).toEqual(['nouveauMotDePasse']);
  });

  // .strict() ferme la porte à toute clé inconnue, role compris (D23).
  it('rejette une clé inconnue', () => {
    expect(valider({ ...VALIDE, role: 'admin' }).success).toBe(false);
  });
});
