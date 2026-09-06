import { describe, it, expect, beforeEach, vi } from 'vitest';
import valider from '../valider.js';
import { schemaInscription } from '../../validation/utilisateur.js';

function creerReponse() {
  return {
    statut: null,
    corps: null,
    status(code) {
      this.statut = code;
      return this;
    },
    json(donnees) {
      this.corps = donnees;
      return this;
    },
  };
}

let next;

beforeEach(() => {
  next = vi.fn();
});

describe('middleware de validation', () => {
  it('remplace le corps par les données normalisées et poursuit', () => {
    const req = { body: { email: '  Camille@Example.FR ', motDePasse: 'motdepasse-solide' } };
    const res = creerReponse();

    valider(schemaInscription)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body.email).toBe('camille@example.fr');
  });

  it('renvoie 400 avec la liste des champs en erreur', () => {
    const req = { body: { email: 'invalide', motDePasse: 'court' } };
    const res = creerReponse();

    valider(schemaInscription)(req, res, next);

    expect(res.statut).toBe(400);
    expect(next).not.toHaveBeenCalled();
    const champsEnErreur = res.corps.champs.map((entree) => entree.champ);
    expect(champsEnErreur).toContain('email');
    expect(champsEnErreur).toContain('motDePasse');
  });

  it('renvoie 400 quand le corps contient un champ role', () => {
    const req = {
      body: { email: 'camille@example.fr', motDePasse: 'motdepasse-solide', role: 'admin' },
    };
    const res = creerReponse();

    valider(schemaInscription)(req, res, next);

    expect(res.statut).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });
});
