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

// Même opération que côté interface : un montant multiplié par un taux, arrondi au plus
// proche, les demis s'écartant de zéro.
//
// Le résultat porte autant de décimales que le montant reçu, avec un plancher au
// centime. La règle vient de ce que la même fonction sert deux natures de valeurs : les
// montants du patrimoine, réglés au centime, et les cours, qui descendent bien plus bas.
// Forcer deux décimales faisait disparaître un cours de 0,005 euro à la bascule de
// devise, alors qu'il s'affichait correctement en euros.
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
