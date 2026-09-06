import { describe, it, expect } from 'vitest';
import { fenetreDePeriode, reculerDe } from '../serie';

// Découpage d'une série par plage.
//
// Ce que ces tests protègent, c'est la différence entre compter des jours et compter des
// points. Les deux donnent le même résultat sur une série continue, et divergent dès
// qu'elle est trouée — ce qu'elle est en pratique, un relevé n'existant que si
// l'utilisateur a consulté ce jour-là.

const SERIE = [
  { date_snapshot: '2025-10-01', valeur_totale_eur: '9000.00' },
  { date_snapshot: '2026-02-14', valeur_totale_eur: '9500.00' },
  { date_snapshot: '2026-07-20', valeur_totale_eur: '11000.00' },
  { date_snapshot: '2026-08-05', valeur_totale_eur: '12000.00' },
  { date_snapshot: '2026-08-10', valeur_totale_eur: '12200.00' },
  { date_snapshot: '2026-08-11', valeur_totale_eur: '12480.65' },
];

function dates(points) {
  return points.map((point) => point.date_snapshot);
}

describe('fenêtre d’une plage', () => {
  it('garde les points des trente derniers jours, pas les trente derniers points', () => {
    // Quatre relevés dans les trente jours sur six au total. Un découpage par nombre de
    // points aurait ramené toute la série et annoncé dix mois sous l'étiquette « Mois ».
    expect(dates(fenetreDePeriode(SERIE, 30))).toEqual([
      '2026-07-20',
      '2026-08-05',
      '2026-08-10',
      '2026-08-11',
    ]);
  });

  it('compte les jours depuis le dernier relevé, pas depuis aujourd’hui', () => {
    // Le serveur calcule ainsi les performances de chaque plage. Compter depuis la date
    // du jour ferait porter la courbe et le pourcentage affiché à côté sur deux
    // ensembles de points différents, ce qui se lirait comme une erreur de calcul.
    expect(dates(fenetreDePeriode(SERIE, 7))).toEqual([
      '2026-08-05',
      '2026-08-10',
      '2026-08-11',
    ]);
  });

  it('inclut la borne exacte', () => {
    // Sept jours avant le 11 août, c'est le 4 : le relevé du 5 est dedans. Une borne
    // stricte retirerait un point sans que rien ne le dise.
    expect(dates(fenetreDePeriode(SERIE, 6))).toEqual(['2026-08-05', '2026-08-10', '2026-08-11']);
    expect(dates(fenetreDePeriode(SERIE, 5))).toEqual(['2026-08-10', '2026-08-11']);
  });

  it('rend la série entière pour la plage depuis l’origine', () => {
    expect(fenetreDePeriode(SERIE, null)).toHaveLength(6);
    expect(fenetreDePeriode(SERIE, undefined)).toHaveLength(6);
  });

  it('rend une série vide sans rien inventer', () => {
    expect(fenetreDePeriode([], 30)).toEqual([]);
    expect(fenetreDePeriode(null, 30)).toEqual([]);
  });

  it('accepte un autre nom de champ de date', () => {
    const cours = [{ jour: '2026-08-01' }, { jour: '2026-08-11' }];
    expect(fenetreDePeriode(cours, 5, 'jour')).toEqual([{ jour: '2026-08-11' }]);
  });
});

describe('recul de date', () => {
  it('traverse un changement de mois et une année bissextile', () => {
    expect(reculerDe('2026-03-01', 1)).toBe('2026-02-28');
    expect(reculerDe('2024-03-01', 1)).toBe('2024-02-29');
    expect(reculerDe('2026-01-01', 1)).toBe('2025-12-31');
  });

  it('ne décale pas d’un jour selon le fuseau', () => {
    // Le calcul passe par Date.UTC et non par l'analyse d'une chaîne : une date seule
    // interprétée dans le fuseau local recule d'un jour à l'ouest de Greenwich.
    expect(reculerDe('2026-08-11', 0)).toBe('2026-08-11');
    expect(reculerDe('2026-08-11', 365)).toBe('2025-08-11');
  });
});
