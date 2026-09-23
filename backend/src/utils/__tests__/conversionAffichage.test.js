import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ECHELLE_MONTANT,
  ECHELLE_TAUX,
  versUnites,
  multiplier,
  formater,
} from '../decimal.js';

// Jeu d'essai partagé avec l'interface : la conversion euro/dollar existe des deux
// côtés, et le serveur doit produire exactement les mêmes chaînes sur les mêmes entrées.
// La suite jumelle est `frontend/src/utils/__tests__/conversion.test.js`.
const JEU_ESSAI = JSON.parse(
  readFileSync(resolve(process.cwd(), '../fixtures/conversion-affichage.json'), 'utf8')
);

// Même opération que côté interface : un montant multiplié par un taux, arrondi au plus
// proche, les demis s'écartant de zéro.
//
// Le résultat porte autant de décimales que le montant reçu, avec un plancher au
// centime : la fonction sert aussi aux cours, qui descendent sous le centime.
function decimalesDe(valeur) {
  const [, decimale = ''] = valeur.split('.');
  return decimale.length;
}

function convertir(montant, taux) {
  const decimalesSortie = Math.max(ECHELLE_MONTANT, decimalesDe(montant));

  const produit = multiplier(
    versUnites(montant, decimalesSortie),
    decimalesSortie,
    versUnites(taux, ECHELLE_TAUX),
    ECHELLE_TAUX,
    decimalesSortie
  );

  return formater(produit, decimalesSortie, decimalesSortie);
}

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
