import { describe, it, expect } from 'vitest';
import { bornes, hauteurDeBascule } from '../echelleCourbe';

// La bascule est la hauteur, de haut en bas entre 0 et 1, où l'aire de la courbe passe
// du positif au négatif : c'est la ligne du prix de revient. Le geste graphique propre à
// l'application repose entièrement sur ce calcul.

const HAUTEURS = [100, 150, 120];

describe('échelle verticale de la courbe', () => {
  it("englobe le prix de revient, même hors des données", () => {
    expect(bornes(HAUTEURS, 130)).toEqual([100, 150]);
    // Position toujours en gain : sans cette extension, la ligne de référence sortirait
    // du cadre et la bascule n'aurait rien à montrer.
    expect(bornes(HAUTEURS, 80)).toEqual([80, 150]);
    expect(bornes(HAUTEURS, 200)).toEqual([100, 200]);
  });
});

describe('hauteur de bascule', () => {
  it('place la bascule à la proportion attendue du cadre', () => {
    // 130 sur une échelle de 100 à 150 se situe à 40 % depuis le haut.
    expect(hauteurDeBascule(HAUTEURS, 130)).toBeCloseTo(0.4, 10);
    expect(hauteurDeBascule(HAUTEURS, 100)).toBeCloseTo(1, 10);
    expect(hauteurDeBascule(HAUTEURS, 150)).toBeCloseTo(0, 10);
  });

  it("colle la bascule au bord lorsque le prix de revient borne l'échelle", () => {
    expect(hauteurDeBascule(HAUTEURS, 80)).toBeCloseTo(1, 10);
    expect(hauteurDeBascule(HAUTEURS, 200)).toBeCloseTo(0, 10);
  });

  // Sans prix de revient, il n'y a pas deux zones à distinguer : l'aire garde la teinte
  // du sens de la période.
  it('ne rend aucune bascule sans prix de revient', () => {
    expect(hauteurDeBascule(HAUTEURS, null)).toBeNull();
    expect(hauteurDeBascule(HAUTEURS, Number.NaN)).toBeNull();
  });

  it('ne divise jamais par zéro sur une série plate au prix de revient', () => {
    expect(hauteurDeBascule([100, 100], 100)).toBeNull();
    expect(hauteurDeBascule([], 100)).toBeNull();
  });

  // Une série plate au-dessus de son prix de revient garde une bascule utile : toute
  // l'aire doit être du côté positif.
  it("garde une bascule sur une série plate au-dessus du prix de revient", () => {
    expect(hauteurDeBascule([120, 120], 100)).toBeCloseTo(1, 10);
  });
});
