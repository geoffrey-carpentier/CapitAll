import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requete, definirRappelSessionPerdue, ErreurApi } from '../api';

function reponseFactice({ statut = 200, corps = {} } = {}) {
  return {
    ok: statut >= 200 && statut < 300,
    status: statut,
    json: async () => corps,
  };
}

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  definirRappelSessionPerdue(null);
  vi.restoreAllMocks();
});

describe("client d'API", () => {
  it("ajoute l'en-tête d'autorisation quand un jeton est fourni", async () => {
    global.fetch.mockResolvedValue(reponseFactice({ corps: { ok: true } }));

    await requete('/portefeuille', { jeton: 'jeton-de-test' });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer jeton-de-test');
  });

  it("omet l'en-tête d'autorisation en l'absence de jeton", async () => {
    global.fetch.mockResolvedValue(reponseFactice({ corps: { ok: true } }));

    await requete('/auth/connexion', { methode: 'POST', corps: { email: 'a@b.fr' } });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  // Le jeton expire au bout de deux heures : ce cas se produit en usage réel, et
  // l'interface doit alors renvoyer l'utilisateur vers la connexion.
  it('déclenche la perte de session sur une réponse 401', async () => {
    const surSessionPerdue = vi.fn();
    definirRappelSessionPerdue(surSessionPerdue);
    global.fetch.mockResolvedValue(
      reponseFactice({ statut: 401, corps: { erreur: "Jeton d'authentification invalide ou expiré." } })
    );

    await expect(requete('/portefeuille', { jeton: 'perime' })).rejects.toThrow(ErreurApi);
    expect(surSessionPerdue).toHaveBeenCalledTimes(1);
  });

  it('ne déclenche pas la perte de session sur une autre erreur', async () => {
    const surSessionPerdue = vi.fn();
    definirRappelSessionPerdue(surSessionPerdue);
    global.fetch.mockResolvedValue(reponseFactice({ statut: 409, corps: { erreur: 'Déjà utilisé.' } }));

    await expect(requete('/auth/inscription', { methode: 'POST', corps: {} })).rejects.toThrow(
      'Déjà utilisé.'
    );
    expect(surSessionPerdue).not.toHaveBeenCalled();
  });

  it("expose le message du serveur sans le reformuler", async () => {
    global.fetch.mockResolvedValue(
      reponseFactice({ statut: 401, corps: { erreur: 'Email ou mot de passe incorrect.' } })
    );

    await expect(requete('/auth/connexion', { methode: 'POST', corps: {} })).rejects.toThrow(
      'Email ou mot de passe incorrect.'
    );
  });

  it('traduit une panne réseau en message lisible', async () => {
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(requete('/portefeuille')).rejects.toThrow(/injoignable/);
  });
});
