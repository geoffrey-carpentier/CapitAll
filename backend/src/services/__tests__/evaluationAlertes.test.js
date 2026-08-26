import { describe, it, expect } from 'vitest';
import { evaluerAlertes, estFranchi, ecartRestant, valeurObservee } from '../evaluationAlertes.js';

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

describe('écart restant avant franchissement (E6)', () => {
  // 65 000 - 61 240 rapporté à 61 240 : la hausse qu'il reste à faire depuis le cours
  // actuel, et non depuis le seuil.
  it('rend la hausse restante pour un seuil haut pas encore atteint', () => {
    expect(ecartRestant('au_dessus', '61240.00', '65000.00')).toBe('6.14');
  });

  it('rend la baisse restante pour un seuil bas pas encore atteint', () => {
    expect(ecartRestant('en_dessous', '2627.32', '2200.00')).toBe('16.26');
  });

  // Une valeur déjà au-delà du seuil, dans le sens qui le franchit, rend 0 et non un
  // nombre négatif, qui n'aurait pas de sens pour un écart restant.
  it('rend zéro quand le seuil est déjà franchi', () => {
    expect(ecartRestant('au_dessus', '70000.00', '65000.00')).toBe('0');
    expect(ecartRestant('au_dessus', '65000.00', '65000.00')).toBe('0');
  });

  // Même règle côté seuil bas : la revue a signalé que seul le sens au-dessus était
  // couvert par le cas précédent.
  it('rend zéro quand un seuil bas est déjà franchi', () => {
    expect(ecartRestant('en_dessous', '45000.00', '50000.00')).toBe('0');
    expect(ecartRestant('en_dessous', '50000.00', '50000.00')).toBe('0');
  });

  it('rend null quand la valeur observée est indisponible', () => {
    expect(ecartRestant('au_dessus', null, '65000.00')).toBeNull();
    expect(ecartRestant('au_dessus', undefined, '65000.00')).toBeNull();
  });

  // Deux décimales fixes, comme tout pourcentage rendu par le serveur (pourcentage_variation,
  // performances) : la valeur ne perd jamais ses zéros de fin, contrairement à un montant.
  it('reste exact sur des valeurs à décimales, à deux décimales fixes', () => {
    expect(ecartRestant('au_dessus', '0.3', '0.33')).toBe('10.00');
  });

  // Un seuil à 0 est impossible en pratique (le schéma Zod exige une valeur strictement
  // positive à la création), mais la fonction ne doit pas se comporter n'importe comment
  // si elle en reçoit un malgré tout. La division porte sur la valeur observée, jamais
  // sur le seuil : aucune division par zéro ne peut se produire de ce côté-là.
  it('reste défini sur un seuil à zéro, sans franchissement au sens bas', () => {
    expect(ecartRestant('en_dessous', '100.00', '0')).toBe('100.00');
  });
});

describe('valeur observée (E6)', () => {
  it('rend le capital total pour une alerte sur le capital total', () => {
    const alerte = { type_cible: 'capital_total' };
    expect(valeurObservee(alerte, { capitalTotal: '58566.64', coursParActif: {} })).toBe(
      '58566.64'
    );
  });

  it('rend le cours de la cible pour une alerte sur un actif', () => {
    const alerte = { type_cible: 'actif', actif_id: 10 };
    expect(
      valeurObservee(alerte, { capitalTotal: '0', coursParActif: { 10: '70000.00' } })
    ).toBe('70000.00');
  });

  // Le cours indisponible est le cas normal d'un actif sans fournisseur joignable :
  // la valeur observée est alors absente, jamais une valeur inventée.
  it("rend null quand l'actif est absent de la table des cours", () => {
    const alerte = { type_cible: 'actif', actif_id: 99 };
    expect(valeurObservee(alerte, { capitalTotal: '0', coursParActif: {} })).toBeNull();
  });

  // Distinct du cas précédent : ici la clé existe mais porte une chaîne vide. `??` ne
  // la remplace pas, contrairement à `undefined` ; c'est `ecartRestant`, en aval, qui
  // traite cette chaîne vide comme une valeur indisponible.
  it("rend la chaîne vide telle quelle quand le cours de l'actif est vide", () => {
    const alerte = { type_cible: 'actif', actif_id: 10 };
    expect(valeurObservee(alerte, { capitalTotal: '0', coursParActif: { 10: '' } })).toBe('');
  });
});
