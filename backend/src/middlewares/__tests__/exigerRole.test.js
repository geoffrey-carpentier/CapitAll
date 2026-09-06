import { describe, it, expect, beforeEach, vi } from 'vitest';
import exigerRole from '../exigerRole.js';

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

describe('middleware de contrôle de rôle', () => {
  it('laisse passer un utilisateur dont le rôle correspond', () => {
    const res = creerReponse();
    exigerRole('admin')({ utilisateur: { id: 1, role: 'admin' } }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statut).toBeNull();
  });

  it('refuse un utilisateur dont le rôle ne correspond pas', () => {
    const res = creerReponse();
    exigerRole('admin')({ utilisateur: { id: 2, role: 'utilisateur' } }, res, next);

    expect(res.statut).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  // Le middleware n'est jamais employé seul : sans authentifier en amont, il n'y a pas
  // de rôle à contrôler, et la requête doit être refusée plutôt que laissée passer.
  it('refuse une requête non authentifiée', () => {
    const res = creerReponse();
    exigerRole('admin')({}, res, next);

    expect(res.statut).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
