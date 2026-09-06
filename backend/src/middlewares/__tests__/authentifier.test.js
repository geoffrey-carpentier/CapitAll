import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const SECRET = 'b'.repeat(32);

let creerAuthentifier;

// Le middleware lit la configuration au chargement : l'environnement doit être en place
// avant l'import, d'où l'import dynamique.
beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://utilisateur:secret@localhost:5432/walletwatch';
  process.env.JWT_SECRET = SECRET;
  ({ creerAuthentifier } = await import('../authentifier.js'));
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

const COMPTE = { id: 42, role: 'admin', actif: true, jetons_invalides_avant: null };

let next;

// Le compte est relu à chaque requête depuis D60 complétée : le middleware reçoit donc
// son modèle, comme les services, et s'exécute sans base.
function monter(compte = COMPTE) {
  const utilisateurs = { trouverPourAutorisation: vi.fn().mockResolvedValue(compte) };
  return { authentifier: creerAuthentifier({ utilisateurs }), utilisateurs };
}

beforeEach(() => {
  next = vi.fn();
});

describe("middleware d'authentification", () => {
  it('refuse une requête sans en-tête Authorization', async () => {
    const { authentifier } = monter();
    const res = creerReponse();
    await authentifier({ headers: {} }, res, next);

    expect(res.statut).toBe(401);
    expect(res.corps.erreur).toMatch(/absent/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('refuse un en-tête mal formé, sans préfixe Bearer', async () => {
    const { authentifier } = monter();
    const res = creerReponse();
    await authentifier({ headers: { authorization: 'jeton-sans-prefixe' } }, res, next);

    expect(res.statut).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('refuse un jeton dont la signature est invalide', async () => {
    const { authentifier, utilisateurs } = monter();
    const token = jwt.sign({ sub: 1, role: 'utilisateur' }, 'un-autre-secret-de-32-caracteres');
    const res = creerReponse();
    await authentifier({ headers: { authorization: `Bearer ${token}` } }, res, next);

    expect(res.statut).toBe(401);
    expect(res.corps.erreur).toMatch(/invalide ou expiré/i);
    expect(next).not.toHaveBeenCalled();
    // La base n'est pas même interrogée : une signature fausse se voit sans elle.
    expect(utilisateurs.trouverPourAutorisation).not.toHaveBeenCalled();
  });

  it('refuse un jeton expiré', async () => {
    const { authentifier } = monter();
    const token = jwt.sign({ sub: 1, role: 'utilisateur' }, SECRET, { expiresIn: '-1s' });
    const res = creerReponse();
    await authentifier({ headers: { authorization: `Bearer ${token}` } }, res, next);

    expect(res.statut).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepte un jeton valide et attache l'utilisateur à la requête", async () => {
    const { authentifier } = monter();
    const token = jwt.sign({ sub: 42, role: 'admin' }, SECRET, { algorithm: 'HS256' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = creerReponse();

    await authentifier(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.utilisateur).toEqual({ id: 42, role: 'admin' });
    expect(res.statut).toBeNull();
  });

  // Un jeton signé avec l'algorithme "none" ne doit jamais être accepté.
  it('refuse un jeton non signé', async () => {
    const { authentifier } = monter();
    const token = jwt.sign({ sub: 1, role: 'admin' }, null, { algorithm: 'none' });
    const res = creerReponse();
    await authentifier({ headers: { authorization: `Bearer ${token}` } }, res, next);

    expect(res.statut).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// D60 créait la désactivation d'un compte et la connexion la respectait ; un jeton déjà
// émis continuait pourtant de servir jusqu'à son expiration, soit deux heures. La
// désactivation était annoncée sans être appliquée.
describe('révocation, à chaque requête', () => {
  it('refuse le jeton d’un compte désactivé', async () => {
    const { authentifier } = monter({ ...COMPTE, actif: false });
    const token = jwt.sign({ sub: 42, role: 'admin' }, SECRET);
    const res = creerReponse();

    await authentifier({ headers: { authorization: `Bearer ${token}` } }, res, next);

    // 401 et non 403 : c'est le signal auquel l'interface réagit en vidant son état.
    // Un 403 laisserait l'utilisateur devant un écran mort, avec un jeton inutilisable.
    expect(res.statut).toBe(401);
    expect(res.corps.erreur).toMatch(/session a été close/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('refuse le jeton d’un compte supprimé depuis l’émission', async () => {
    const { authentifier } = monter(null);
    const token = jwt.sign({ sub: 42, role: 'admin' }, SECRET);
    const res = creerReponse();

    await authentifier({ headers: { authorization: `Bearer ${token}` } }, res, next);

    expect(res.statut).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('refuse un jeton émis avant la borne de révocation', async () => {
    const borne = new Date();
    const { authentifier } = monter({ ...COMPTE, jetons_invalides_avant: borne });
    // Émis dix minutes avant le changement de mot de passe.
    const token = jwt.sign(
      { sub: 42, role: 'admin', iat: Math.floor(borne.getTime() / 1000) - 600 },
      SECRET
    );
    const res = creerReponse();

    await authentifier({ headers: { authorization: `Bearer ${token}` } }, res, next);

    expect(res.statut).toBe(401);
    expect(res.corps.erreur).toMatch(/session a été close/i);
  });

  it('accepte un jeton émis après la borne', async () => {
    const borne = new Date();
    const { authentifier } = monter({ ...COMPTE, jetons_invalides_avant: borne });
    const token = jwt.sign(
      { sub: 42, role: 'admin', iat: Math.floor(borne.getTime() / 1000) + 5 },
      SECRET
    );
    const res = creerReponse();

    await authentifier({ headers: { authorization: `Bearer ${token}` } }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('accepte le jeton émis dans la seconde même de la borne', async () => {
    // C'est le jeton neuf remis par le changement de mot de passe. Arrondir dans
    // l'autre sens le refuserait, et déconnecterait l'utilisateur de l'opération qu'il
    // vient de réussir.
    const borne = new Date();
    const { authentifier } = monter({ ...COMPTE, jetons_invalides_avant: borne });
    const token = jwt.sign(
      { sub: 42, role: 'admin', iat: Math.floor(borne.getTime() / 1000) },
      SECRET
    );
    const res = creerReponse();

    await authentifier({ headers: { authorization: `Bearer ${token}` } }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('relit le rôle en base plutôt que de le reprendre du jeton', async () => {
    // Un rôle retiré doit prendre effet immédiatement. Le jeton, lui, porte celui qui
    // valait à l'émission et vivrait deux heures de plus.
    const { authentifier } = monter({ ...COMPTE, role: 'utilisateur' });
    const token = jwt.sign({ sub: 42, role: 'admin' }, SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = creerReponse();

    await authentifier(req, res, next);

    expect(req.utilisateur.role).toBe('utilisateur');
  });

  it('transmet une panne de base au gestionnaire d’erreurs', async () => {
    // Une base indisponible n'est pas un refus d'authentification : la traiter en 401
    // déconnecterait tout le monde à la première coupure.
    const utilisateurs = {
      trouverPourAutorisation: vi.fn().mockRejectedValue(new Error('base injoignable')),
    };
    const authentifier = creerAuthentifier({ utilisateurs });
    const token = jwt.sign({ sub: 42, role: 'admin' }, SECRET);
    const res = creerReponse();

    await authentifier({ headers: { authorization: `Bearer ${token}` } }, res, next);

    expect(res.statut).toBeNull();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});
