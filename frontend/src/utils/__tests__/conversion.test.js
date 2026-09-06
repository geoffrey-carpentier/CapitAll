import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { convertir } from '../conversion';

// Jeu d'essai partagé avec le serveur (D69). Les deux implémentations de la conversion
// d'affichage doivent rendre exactement les mêmes chaînes : la multiplication existe des
// deux côtés, et deux règles d'arrondi divergentes produiraient des écarts d'un centime
// que personne ne saurait expliquer.
//
// Le fichier est lu plutôt qu'importé : il vit à la racine du dépôt, hors de l'espace
// que le résolveur de modules de l'interface couvre. Le copier ici aurait ruiné son
// intérêt, qui est d'être un fichier unique.
// Le chemin part du dossier d'exécution de la suite, `frontend/`, et non de ce fichier :
// sous Vitest, l'URL du module n'est pas une adresse de fichier utilisable telle quelle.
const JEU_ESSAI = JSON.parse(
  readFileSync(resolve(process.cwd(), '../fixtures/conversion-affichage.json'), 'utf8')
);

describe("jeu d'essai partagé de la conversion d'affichage", () => {
  it('couvre les cas attendus', () => {
    expect(JEU_ESSAI.cas.length).toBeGreaterThanOrEqual(9);
  });

  JEU_ESSAI.cas.forEach(({ libelle, montant, taux, attendu }) => {
    it(`rend ${attendu} pour ${libelle}`, () => {
      expect(convertir(montant, taux)).toBe(attendu);
    });
  });
});

describe('robustesse de la conversion', () => {
  it("refuse une entrée qui n'est pas une chaîne décimale", () => {
    expect(convertir('abc', '1.1364')).toBeNull();
    expect(convertir('100.00', 'abc')).toBeNull();
    expect(convertir(null, '1.1364')).toBeNull();
    expect(convertir('100.00', null)).toBeNull();
    // Un nombre est refusé au même titre : accepter un flottant en entrée reviendrait à
    // faire entrer dans la chaîne l'erreur que tout ce module sert à éviter.
    expect(convertir(100, '1.1364')).toBeNull();
  });

  it('conserve toute la précision du taux transmis', () => {
    expect(convertir('1000.00', '1.138952164009')).toBe('1138.95');
  });
});
