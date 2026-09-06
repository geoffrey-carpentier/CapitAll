import { describe, it, expect } from 'vitest';
import { schemaChangementMotDePasse, schemaSuppressionCompte } from '../compte.js';

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

describe('suppression du compte (E7)', () => {
  it('accepte un mot de passe de confirmation', () => {
    expect(schemaSuppressionCompte.safeParse({ motDePasse: 'peu-importe' }).success).toBe(true);
  });

  it('refuse une suppression sans mot de passe', () => {
    expect(schemaSuppressionCompte.safeParse({}).success).toBe(false);
    expect(schemaSuppressionCompte.safeParse({ motDePasse: '' }).success).toBe(false);
  });

  it('rejette une clé inconnue', () => {
    expect(
      schemaSuppressionCompte.safeParse({ motDePasse: 'x', utilisateur_id: 1 }).success
    ).toBe(false);
  });
});

describe('messages en français', () => {
  // Sans message explicite sur z.string, une clé absente produirait le libellé anglais
  // par défaut de la bibliothèque, qui remonterait tel quel jusqu'à l'écran.
  it('nomme en français une clé absente', () => {
    const suppression = schemaSuppressionCompte.safeParse({});
    expect(suppression.error.issues[0].message).toBe('Le mot de passe est obligatoire.');

    const changement = schemaChangementMotDePasse.safeParse({ nouveauMotDePasse: 'assez-long-ok' });
    expect(changement.error.issues[0].message).toBe("L'ancien mot de passe est obligatoire.");
  });
});
