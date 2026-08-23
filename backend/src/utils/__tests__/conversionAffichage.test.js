import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ECHELLE_MONTANT,
  ECHELLE_PRU,
  versUnites,
  multiplier,
  formater,
} from '../decimal.js';

// Jeu d'essai partagé avec l'interface (D69).
//
// La conversion d'affichage euro/dollar est la seule opération arithmétique que
// l'interface réalise sur un montant, et elle est donc la seule à exister des deux côtés
// du dossier. Ce fichier vérifie que le serveur, avec son arithmétique en entiers,
// produit exactement les mêmes chaînes que l'interface sur les mêmes entrées. Si l'une
// des deux règles d'arrondi dérive un jour, la divergence apparaît ici avant d'apparaître
// à l'écran sous la forme d'un centime inexplicable.
//
// La suite jumelle est `frontend/src/utils/__tests__/conversion.test.js`.
const JEU_ESSAI = JSON.parse(
  readFileSync(resolve(process.cwd(), '../fixtures/conversion-affichage.json'), 'utf8')
);

// Même opération que côté interface : un montant à deux décimales multiplié par un taux,
// arrondi au centime au plus proche, les demis s'écartant de zéro.
function convertir(montant, taux) {
  const produit = multiplier(
    versUnites(montant, ECHELLE_MONTANT),
    versUnites(taux, ECHELLE_PRU),
    ECHELLE_PRU
  );

  return formater(produit, ECHELLE_MONTANT, ECHELLE_MONTANT);
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
