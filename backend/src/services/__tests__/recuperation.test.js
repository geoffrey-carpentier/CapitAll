import { describe, it, expect, vi, beforeAll } from 'vitest';
import crypto from 'node:crypto';

// Récupération d'un mot de passe oublié (D23, S-28).
//
// Deux exigences gouvernent ce parcours, et elles tirent en sens contraire : il doit
// fonctionner sans que l'utilisateur soit connecté, et il ne doit rien apprendre à qui
// n'a pas de compte. La plupart des tests ci-dessous portent sur la seconde.

let creerServiceRecuperation;
let MESSAGE_NEUTRE;

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://utilisateur:secret@localhost:5432/walletwatch';
  process.env.JWT_SECRET = 'd'.repeat(32);
  ({ creerServiceRecuperation, MESSAGE_NEUTRE } = await import('../recuperation.js'));
});

const COMPTE = {
  id: 7,
  email: 'camille@exemple.test',
  actif: true,
  mot_de_passe_hache: 'peu importe',
};

function monter({ compte = COMPTE, demande = null, afficherJeton = false } = {}) {
  const utilisateurs = {
    trouverParEmail: vi.fn().mockResolvedValue(compte),
    mettreAJourMotDePasse: vi.fn().mockResolvedValue(true),
  };
  const demandes = {
    creer: vi.fn().mockImplementation(async (donnees) => ({ id: 1, ...donnees })),
    trouverParEmpreinte: vi.fn().mockResolvedValue(demande),
    marquerUtilisee: vi.fn().mockResolvedValue(true),
    invaliderPour: vi.fn().mockResolvedValue(0),
  };

  return {
    service: creerServiceRecuperation({
      utilisateurs,
      demandes,
      parametres: { afficherJetonReinitialisation: afficherJeton },
    }),
    utilisateurs,
    demandes,
  };
}

function demandeValide(jeton, champs = {}) {
  return {
    id: 1,
    utilisateur_id: 7,
    expire_le: new Date(Date.now() + 30 * 60 * 1000),
    utilise_le: null,
    actif: true,
    email: COMPTE.email,
    ...champs,
    _jeton: jeton,
  };
}

describe('demande de réinitialisation', () => {
  it('rend le même message pour une adresse connue et pour une inconnue', async () => {
    const connue = monter();
    const inconnue = monter({ compte: null });

    const reponseConnue = await connue.service.demander({ email: COMPTE.email });
    const reponseInconnue = await inconnue.service.demander({ email: 'personne@exemple.test' });

    // C'est ce qui interdit de se servir du formulaire pour découvrir quelles adresses
    // ont un compte.
    expect(reponseConnue.message).toBe(MESSAGE_NEUTRE);
    expect(reponseInconnue.message).toBe(MESSAGE_NEUTRE);
    expect(reponseConnue).toEqual(reponseInconnue);
  });

  it('ne crée rien pour une adresse inconnue', async () => {
    const { service, demandes } = monter({ compte: null });

    await service.demander({ email: 'personne@exemple.test' });

    expect(demandes.creer).not.toHaveBeenCalled();
  });

  it('ne crée rien pour un compte désactivé', async () => {
    // Un compte désactivé ne se réactive pas par ce chemin.
    const { service, demandes } = monter({ compte: { ...COMPTE, actif: false } });

    const reponse = await service.demander({ email: COMPTE.email });

    expect(demandes.creer).not.toHaveBeenCalled();
    expect(reponse.message).toBe(MESSAGE_NEUTRE);
  });

  it('ne conserve que l’empreinte du jeton, jamais le jeton', async () => {
    const { service, demandes } = monter({ afficherJeton: true });

    const reponse = await service.demander({ email: COMPTE.email });
    const enregistre = demandes.creer.mock.calls[0][0];

    // Une base lue par un tiers ne doit donner aucun moyen de prendre la main sur un
    // compte : c'est toute la raison de ne pas stocker le jeton lui-même.
    expect(enregistre.jetonHache).not.toBe(reponse.jeton);
    expect(enregistre.jetonHache).toBe(
      crypto.createHash('sha256').update(reponse.jeton).digest('hex')
    );
    expect(JSON.stringify(enregistre)).not.toContain(reponse.jeton);
  });

  it('annule les demandes précédentes du compte', async () => {
    // Sans cela, un jeton obtenu puis oublié resterait utilisable jusqu'à son
    // expiration, et le nombre de clés en circulation n'aurait aucune borne.
    const { service, demandes } = monter();

    await service.demander({ email: COMPTE.email });

    expect(demandes.invaliderPour).toHaveBeenCalledWith(7);
  });

  it('ne rend pas le jeton quand la commodité de démonstration est fermée', async () => {
    const { service } = monter({ afficherJeton: false });

    const reponse = await service.demander({ email: COMPTE.email });

    expect(reponse.jeton).toBeNull();
  });

  it('rend le jeton et sa date d’expiration quand elle est ouverte', async () => {
    const { service } = monter({ afficherJeton: true });

    const reponse = await service.demander({ email: COMPTE.email });

    expect(reponse.jeton).toMatch(/^[0-9a-f]{64}$/);
    expect(Number.isNaN(Date.parse(reponse.expire_le))).toBe(false);
  });

  it('tire un jeton différent à chaque demande', async () => {
    const { service } = monter({ afficherJeton: true });

    const premiere = await service.demander({ email: COMPTE.email });
    const seconde = await service.demander({ email: COMPTE.email });

    expect(premiere.jeton).not.toBe(seconde.jeton);
  });
});

describe('usage du jeton', () => {
  const JETON = 'a'.repeat(64);

  it('pose le nouveau mot de passe et révoque les sessions', async () => {
    const { service, utilisateurs } = monter({ demande: demandeValide(JETON) });

    await service.reinitialiser({ jeton: JETON, nouveauMotDePasse: 'nouveau-mot-de-passe' });

    // mettreAJourMotDePasse pose la borne de révocation dans la même requête : on
    // réinitialise précisément quand on ne maîtrise plus l'accès, et laisser vivre les
    // sessions ouvertes viderait l'opération de son sens.
    expect(utilisateurs.mettreAJourMotDePasse).toHaveBeenCalledTimes(1);
    expect(utilisateurs.mettreAJourMotDePasse.mock.calls[0][0]).toBe(7);
  });

  it('consomme la demande avant d’écrire', async () => {
    const { service, demandes, utilisateurs } = monter({ demande: demandeValide(JETON) });
    const ordre = [];

    demandes.marquerUtilisee.mockImplementation(async () => {
      ordre.push('consommation');
      return true;
    });
    utilisateurs.mettreAJourMotDePasse.mockImplementation(async () => {
      ordre.push('ecriture');
      return true;
    });

    await service.reinitialiser({ jeton: JETON, nouveauMotDePasse: 'nouveau-mot-de-passe' });

    expect(ordre).toEqual(['consommation', 'ecriture']);
  });

  it('refuse un jeton inconnu', async () => {
    const { service, utilisateurs } = monter({ demande: null });

    await expect(
      service.reinitialiser({ jeton: JETON, nouveauMotDePasse: 'nouveau-mot-de-passe' })
    ).rejects.toThrow(/inconnue, déjà utilisée ou expirée/);

    expect(utilisateurs.mettreAJourMotDePasse).not.toHaveBeenCalled();
  });

  it('refuse un jeton déjà servi', async () => {
    const { service } = monter({ demande: demandeValide(JETON, { utilise_le: new Date() }) });

    await expect(
      service.reinitialiser({ jeton: JETON, nouveauMotDePasse: 'nouveau-mot-de-passe' })
    ).rejects.toThrow(/inconnue, déjà utilisée ou expirée/);
  });

  it('refuse un jeton expiré', async () => {
    const { service } = monter({
      demande: demandeValide(JETON, { expire_le: new Date(Date.now() - 1000) }),
    });

    await expect(
      service.reinitialiser({ jeton: JETON, nouveauMotDePasse: 'nouveau-mot-de-passe' })
    ).rejects.toThrow(/inconnue, déjà utilisée ou expirée/);
  });

  it('refuse le jeton d’un compte désactivé entre-temps', async () => {
    const { service } = monter({ demande: demandeValide(JETON, { actif: false }) });

    await expect(
      service.reinitialiser({ jeton: JETON, nouveauMotDePasse: 'nouveau-mot-de-passe' })
    ).rejects.toThrow(/inconnue, déjà utilisée ou expirée/);
  });

  it('rend le même refus pour les quatre causes', async () => {
    // Les distinguer apprendrait à un tiers qu'un jeton a existé, et lequel des cas
    // s'applique.
    const causes = [
      null,
      demandeValide(JETON, { utilise_le: new Date() }),
      demandeValide(JETON, { expire_le: new Date(Date.now() - 1000) }),
      demandeValide(JETON, { actif: false }),
    ];

    const messages = [];
    for (const demande of causes) {
      const { service } = monter({ demande });
      await service
        .reinitialiser({ jeton: JETON, nouveauMotDePasse: 'nouveau-mot-de-passe' })
        .catch((erreur) => messages.push(erreur.message));
    }

    expect(new Set(messages).size).toBe(1);
  });

  it('perd la course quand deux appels partagent le même jeton', async () => {
    // La condition d'unicité est portée par la requête de consommation : le second
    // appel ne trouve plus de ligne à marquer et n'écrit rien.
    const { service, demandes, utilisateurs } = monter({ demande: demandeValide(JETON) });
    demandes.marquerUtilisee.mockResolvedValue(false);

    await expect(
      service.reinitialiser({ jeton: JETON, nouveauMotDePasse: 'nouveau-mot-de-passe' })
    ).rejects.toThrow(/inconnue, déjà utilisée ou expirée/);

    expect(utilisateurs.mettreAJourMotDePasse).not.toHaveBeenCalled();
  });
});
