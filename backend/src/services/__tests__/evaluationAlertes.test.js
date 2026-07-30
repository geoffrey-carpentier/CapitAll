import { describe, it, expect } from 'vitest';
import { evaluerAlertes, estFranchi } from '../evaluationAlertes.js';

function alerteActif(sensSeuil, valeurSeuil, { id = 1, actifId = 10, statut = 'active' } = {}) {
  return {
    id,
    type_cible: 'actif',
    actif_id: actifId,
    symbole: 'BTC',
    sens_seuil: sensSeuil,
    valeur_seuil: valeurSeuil,
    statut,
  };
}

function alerteCapital(sensSeuil, valeurSeuil, { id = 2, statut = 'active' } = {}) {
  return {
    id,
    type_cible: 'capital_total',
    actif_id: null,
    sens_seuil: sensSeuil,
    valeur_seuil: valeurSeuil,
    statut,
  };
}

describe('franchissement de seuil', () => {
  describe('sens au-dessus', () => {
    it('franchit sur une valeur strictement supérieure', () => {
      expect(estFranchi('au_dessus', '70000.01', '70000.00')).toBe(true);
    });

    // Le cas d'égalité est le point de D56 : l'utilisateur qui fixe 70 000 attend
    // d'être prévenu quand le cours atteint 70 000, pas quand il le dépasse.
    it('franchit sur une valeur égale au seuil', () => {
      expect(estFranchi('au_dessus', '70000.00', '70000.00')).toBe(true);
    });

    it('ne franchit pas sur une valeur inférieure', () => {
      expect(estFranchi('au_dessus', '69999.99', '70000.00')).toBe(false);
    });
  });

  describe('sens en-dessous', () => {
    it('franchit sur une valeur strictement inférieure', () => {
      expect(estFranchi('en_dessous', '49999.99', '50000.00')).toBe(true);
    });

    it('franchit sur une valeur égale au seuil', () => {
      expect(estFranchi('en_dessous', '50000.00', '50000.00')).toBe(true);
    });

    it('ne franchit pas sur une valeur supérieure', () => {
      expect(estFranchi('en_dessous', '50000.01', '50000.00')).toBe(false);
    });
  });

  it('compare sans imprécision sur des valeurs à décimales', () => {
    expect(estFranchi('au_dessus', '0.3', '0.30000000')).toBe(true);
    expect(estFranchi('au_dessus', '0.29999999', '0.3')).toBe(false);
  });
});

describe('évaluation des alertes', () => {
  it('rend une liste vide sans alerte active', () => {
    expect(evaluerAlertes([], { capitalTotal: '50000.00', coursParActif: {} })).toEqual([]);
  });

  // Point d'interprétation retenu : une alerte sur actif se compare au COURS, pas à
  // la valeur de la position. Ici la position vaut 120 000 (2 unités à 60 000) alors
  // que le cours est de 60 000 : un seuil à 70 000 ne doit pas être franchi.
  it('évalue une alerte sur actif au cours et non à la valeur de la position', () => {
    const franchies = evaluerAlertes([alerteActif('au_dessus', '70000.00')], {
      capitalTotal: '120000.00',
      coursParActif: { 10: '60000.00' },
    });

    expect(franchies).toEqual([]);
  });

  it('franchit une alerte sur actif quand le cours atteint le seuil', () => {
    const franchies = evaluerAlertes([alerteActif('au_dessus', '70000.00')], {
      capitalTotal: '10.00',
      coursParActif: { 10: '70000.00' },
    });

    expect(franchies).toHaveLength(1);
    expect(franchies[0].valeur_observee).toBe('70000.00');
    expect(franchies[0].symbole).toBe('BTC');
  });

  it('franchit une alerte sur le capital total', () => {
    const franchies = evaluerAlertes([alerteCapital('au_dessus', '45000.00')], {
      capitalTotal: '58566.64',
      coursParActif: {},
    });

    expect(franchies).toHaveLength(1);
    expect(franchies[0].type_cible).toBe('capital_total');
    expect(franchies[0].actif_id).toBeNull();
  });

  // Déclencher sur une valeur inconnue serait le pire comportement possible (D56).
  it("n'évalue pas une alerte dont le cours est indisponible", () => {
    const franchies = evaluerAlertes([alerteActif('au_dessus', '1.00')], {
      capitalTotal: '58566.64',
      coursParActif: {},
    });

    expect(franchies).toEqual([]);
  });

  // Réévaluer effacerait la date de premier franchissement, qui est l'information utile.
  it('ne réévalue pas une alerte déjà déclenchée', () => {
    const franchies = evaluerAlertes(
      [alerteActif('au_dessus', '1.00', { statut: 'declenchee' })],
      { capitalTotal: '10.00', coursParActif: { 10: '70000.00' } }
    );

    expect(franchies).toEqual([]);
  });

  it('ignore une alerte désactivée', () => {
    const franchies = evaluerAlertes(
      [alerteActif('au_dessus', '1.00', { statut: 'desactivee' })],
      { capitalTotal: '10.00', coursParActif: { 10: '70000.00' } }
    );

    expect(franchies).toEqual([]);
  });

  it('ne retient que les alertes effectivement franchies parmi plusieurs', () => {
    const franchies = evaluerAlertes(
      [
        alerteActif('au_dessus', '70000.00', { id: 1, actifId: 10 }),
        alerteActif('au_dessus', '90000.00', { id: 2, actifId: 10 }),
        alerteCapital('au_dessus', '45000.00', { id: 3 }),
        alerteCapital('en_dessous', '10000.00', { id: 4 }),
      ],
      { capitalTotal: '58566.64', coursParActif: { 10: '75000.00' } }
    );

    expect(franchies.map((a) => a.id).sort()).toEqual([1, 3]);
  });

  it('conserve le seuil et la valeur observée dans le franchissement', () => {
    const [franchissement] = evaluerAlertes([alerteCapital('au_dessus', '45000.00')], {
      capitalTotal: '58566.64',
      coursParActif: {},
    });

    expect(franchissement.valeur_seuil).toBe('45000.00');
    expect(franchissement.valeur_observee).toBe('58566.64');
    expect(franchissement.sens_seuil).toBe('au_dessus');
  });
});
