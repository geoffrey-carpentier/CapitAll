import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const SECRET = 'b'.repeat(32);

let authentifier;

// Le middleware lit la configuration au chargement : l'environnement doit être en place
// avant l'import, d'où l'import dynamique.
beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://utilisateur:secret@localhost:5432/capitall';
  process.env.JWT_SECRET = SECRET;
  ({ default: authentifier } = await import('../authentifier.js'));
});

// Doublures minimales d'Express : on n'observe que le statut, le corps et l'appel à next.
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

describe("middleware d'authentification", () => {
  it('refuse une requête sans en-tête Authorization', () => {
    const res = creerReponse();
    authentifier({ headers: {} }, res, next);

    expect(res.statut).toBe(401);
    expect(res.corps.erreur).toMatch(/absent/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('refuse un en-tête mal formé, sans préfixe Bearer', () => {
    const res = creerReponse();
    authentifier({ headers: { authorization: 'jeton-sans-prefixe' } }, res, next);

    expect(res.statut).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('refuse un jeton dont la signature est invalide', () => {
    const token = jwt.sign({ sub: 1, role: 'utilisateur' }, 'un-autre-secret-de-32-caracteres');
    const res = creerReponse();
    authentifier({ headers: { authorization: `Bearer ${token}` } }, res, next);

    expect(res.statut).toBe(401);
    expect(res.corps.erreur).toMatch(/invalide ou expiré/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('refuse un jeton expiré', () => {
    const token = jwt.sign({ sub: 1, role: 'utilisateur' }, SECRET, { expiresIn: '-1s' });
    const res = creerReponse();
    authentifier({ headers: { authorization: `Bearer ${token}` } }, res, next);

    expect(res.statut).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepte un jeton valide et attache l'utilisateur à la requête", () => {
    const token = jwt.sign({ sub: 42, role: 'admin' }, SECRET, { algorithm: 'HS256' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = creerReponse();

    authentifier(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.utilisateur).toEqual({ id: 42, role: 'admin' });
    expect(res.statut).toBeNull();
  });

  // Un jeton signé avec l'algorithme "none" ne doit jamais être accepté.
  it('refuse un jeton non signé', () => {
    const token = jwt.sign({ sub: 1, role: 'admin' }, null, { algorithm: 'none' });
    const res = creerReponse();
    authentifier({ headers: { authorization: `Bearer ${token}` } }, res, next);

    expect(res.statut).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
