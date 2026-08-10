import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';

// Le modèle est fourni au service sous forme de doublure : ces tests portent sur les
// règles métier, pas sur l'accès aux données, et n'ont donc besoin d'aucune base.
const modeleFactice = {
  trouverParEmail: vi.fn(),
  creerUtilisateur: vi.fn(),
  trouverParId: vi.fn(),
};

const MOT_DE_PASSE = 'motdepasse-solide';

let connecter;
let hachage;

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://utilisateur:secret@localhost:5432/capitall';
  process.env.JWT_SECRET = 'e'.repeat(32);
  const { creerServiceAuthentification } = await import('../authentification.js');
  ({ connecter } = creerServiceAuthentification({ utilisateurs: modeleFactice }));
  // Haché une seule fois : bcrypt au coût 10 est volontairement lent.
  hachage = await bcrypt.hash(MOT_DE_PASSE, 10);
});

function compte({ actif = true } = {}) {
  return {
    id: 2,
    email: 'camille@example.fr',
    pseudo: 'Camille',
    role: 'utilisateur',
    actif,
    mot_de_passe_hache: hachage,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('connexion', () => {
  it('émet un jeton pour un compte actif', async () => {
    modeleFactice.trouverParEmail.mockResolvedValue(compte());

    const resultat = await connecter({ email: 'camille@example.fr', motDePasse: MOT_DE_PASSE });

    expect(resultat.token).toBeTruthy();
    expect(resultat.utilisateur.email).toBe('camille@example.fr');
  });

  it('ne renvoie jamais le hachage du mot de passe', async () => {
    modeleFactice.trouverParEmail.mockResolvedValue(compte());

    const resultat = await connecter({ email: 'camille@example.fr', motDePasse: MOT_DE_PASSE });

    expect(resultat.utilisateur.mot_de_passe_hache).toBeUndefined();
  });
});

describe('compte désactivé', () => {
  it('refuse la connexion même avec les bons identifiants', async () => {
    modeleFactice.trouverParEmail.mockResolvedValue(compte({ actif: false }));

    await expect(
      connecter({ email: 'camille@example.fr', motDePasse: MOT_DE_PASSE })
    ).rejects.toThrow(/désactivé/i);
  });

  // 403 et non 401 : l'identité est établie, c'est l'accès qui est refusé.
  it('rend le statut 403', async () => {
    modeleFactice.trouverParEmail.mockResolvedValue(compte({ actif: false }));

    try {
      await connecter({ email: 'camille@example.fr', motDePasse: MOT_DE_PASSE });
      throw new Error('une erreur était attendue');
    } catch (erreur) {
      expect(erreur.statut).toBe(403);
    }
  });

  // Le contrôle du compte désactivé se fait après la comparaison de mot de passe :
  // un mauvais mot de passe sur un compte désactivé doit donc produire l'échec
  // générique, et surtout ne pas révéler que ce compte existe.
  it("garde le message générique lorsque le mot de passe est faux sur un compte désactivé", async () => {
    modeleFactice.trouverParEmail.mockResolvedValue(compte({ actif: false }));

    await expect(
      connecter({ email: 'camille@example.fr', motDePasse: 'mauvais-mot-de-passe' })
    ).rejects.toThrow(/incorrect/i);
  });
});

describe("protection contre l'énumération des comptes", () => {
  async function messageEchec(identifiants) {
    try {
      await connecter(identifiants);
      throw new Error('une erreur était attendue');
    } catch (erreur) {
      return erreur.message;
    }
  }

  // Non-régression du comportement le plus important de cette fonction : les deux
  // causes d'échec doivent être indiscernables, faute de quoi il devient possible de
  // découvrir quelles adresses correspondent à un compte.
  it('rend un message rigoureusement identique sur adresse inconnue et sur mot de passe incorrect', async () => {
    modeleFactice.trouverParEmail.mockResolvedValue(null);
    const messageInconnu = await messageEchec({
      email: 'inconnu@example.fr',
      motDePasse: MOT_DE_PASSE,
    });

    modeleFactice.trouverParEmail.mockResolvedValue(compte());
    const messageMauvaisMotDePasse = await messageEchec({
      email: 'camille@example.fr',
      motDePasse: 'mauvais-mot-de-passe',
    });

    expect(messageInconnu).toBe(messageMauvaisMotDePasse);
  });

  it('rend le statut 401 dans les deux cas', async () => {
    modeleFactice.trouverParEmail.mockResolvedValue(null);
    await expect(connecter({ email: 'x@y.fr', motDePasse: MOT_DE_PASSE })).rejects.toMatchObject({
      statut: 401,
    });

    modeleFactice.trouverParEmail.mockResolvedValue(compte());
    await expect(
      connecter({ email: 'camille@example.fr', motDePasse: 'faux' })
    ).rejects.toMatchObject({ statut: 401 });
  });

  // La comparaison bcrypt doit avoir lieu même sur une adresse inconnue : sans elle,
  // la réponse serait immédiate et l'écart de temps trahirait l'absence de compte.
  it('compare un hachage même lorsque le compte est introuvable', async () => {
    const comparer = vi.spyOn(bcrypt, 'compare');
    modeleFactice.trouverParEmail.mockResolvedValue(null);

    await expect(
      connecter({ email: 'inconnu@example.fr', motDePasse: MOT_DE_PASSE })
    ).rejects.toThrow();

    expect(comparer).toHaveBeenCalledTimes(1);
    comparer.mockRestore();
  });
});
