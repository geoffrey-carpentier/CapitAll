import { describe, it, expect } from 'vitest';
import { formaterAnciennete } from '../duree';

// L'instant courant est fixé explicitement : un test qui dépend de l'horloge réelle
// échoue tôt ou tard, et toujours au mauvais moment.
const MAINTENANT = new Date('2026-08-11T12:00:00.000Z');

function ilYa(millisecondes) {
  return new Date(MAINTENANT.getTime() - millisecondes).toISOString();
}

const MINUTE = 60 * 1000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;

describe('ancienneté d\'un horodatage', () => {
  it('reste implicite sous la minute', () => {
    expect(formaterAnciennete(ilYa(0), MAINTENANT)).toBe("à l'instant");
    expect(formaterAnciennete(ilYa(59 * 1000), MAINTENANT)).toBe("à l'instant");
  });

  it('compte en minutes jusqu\'à une heure', () => {
    expect(formaterAnciennete(ilYa(MINUTE), MAINTENANT)).toBe('il y a 1 min');
    expect(formaterAnciennete(ilYa(59 * MINUTE), MAINTENANT)).toBe('il y a 59 min');
  });

  it('compte en heures jusqu\'à un jour', () => {
    expect(formaterAnciennete(ilYa(HEURE), MAINTENANT)).toBe('il y a 1 h');
    expect(formaterAnciennete(ilYa(23 * HEURE), MAINTENANT)).toBe('il y a 23 h');
  });

  it('compte en jours au-delà', () => {
    expect(formaterAnciennete(ilYa(JOUR), MAINTENANT)).toBe('il y a 1 j');
    expect(formaterAnciennete(ilYa(9 * JOUR), MAINTENANT)).toBe('il y a 9 j');
  });

  // Une horloge client en avance sur le serveur donnerait un écart négatif : mieux vaut
  // annoncer un cours frais qu'une durée absurde.
  it('absorbe un horodatage dans le futur', () => {
    expect(formaterAnciennete(ilYa(-5 * MINUTE), MAINTENANT)).toBe("à l'instant");
  });

  it('refuse un horodatage absent ou illisible', () => {
    expect(formaterAnciennete(null, MAINTENANT)).toBeNull();
    expect(formaterAnciennete(undefined, MAINTENANT)).toBeNull();
    expect(formaterAnciennete('pas une date', MAINTENANT)).toBeNull();
  });
});
