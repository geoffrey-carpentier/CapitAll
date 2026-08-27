import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Compte from '../Compte';
import * as contexte from '../../contexte/contexteAuthentification';
import { api, ErreurApi } from '../../services/api';
import { CLE_DEVISE, CLE_MASQUAGE } from '../../utils/preferences';

const PROFIL = {
  id: 2,
  email: 'camille@example.fr',
  pseudo: 'Camille',
  role: 'utilisateur',
  actif: true,
  date_inscription: '2026-05-12T09:30:00.000Z',
};

const deconnecter = vi.fn();

let adresse;
let etatDeNavigation;

function Sonde() {
  const emplacement = useLocation();
  adresse = emplacement.pathname;
  etatDeNavigation = emplacement.state;
  return null;
}

function rendre() {
  vi.spyOn(contexte, 'useAuthentification').mockReturnValue({
    jeton: 'jeton-de-test',
    utilisateur: { pseudo: 'Camille' },
    estConnecte: true,
    deconnecter,
  });

  return render(
    <MemoryRouter initialEntries={['/compte']}>
      <Compte />
      <Sonde />
    </MemoryRouter>
  );
}

async function rendreCharge() {
  rendre();
  await screen.findByRole('heading', { name: 'Compte', level: 1 });
}

beforeEach(() => {
  vi.spyOn(api, 'profil').mockResolvedValue(PROFIL);
  vi.spyOn(api, 'changerMotDePasse').mockResolvedValue(null);
  vi.spyOn(api, 'supprimerCompte').mockResolvedValue(null);
  vi.spyOn(api, 'exporterMouvements').mockResolvedValue({
    blob: new Blob(['date;type\r\n'], { type: 'text/csv' }),
    nomFichier: 'capitall-mouvements-2026-08-27.csv',
  });
  // jsdom ne fournit pas ces deux fonctions : le téléchargement s'appuie dessus.
  URL.createObjectURL = vi.fn(() => 'blob:faux');
  URL.revokeObjectURL = vi.fn();
  window.sessionStorage.clear();
  deconnecter.mockClear();
  adresse = undefined;
  etatDeNavigation = undefined;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('composition', () => {
  it('affiche les cinq sections de l’écran', async () => {
    await rendreCharge();

    for (const titre of ['Informations', 'Sécurité', 'Affichage', 'Données', 'À propos']) {
      expect(screen.getByRole('heading', { name: titre })).toBeTruthy();
    }
  });

  it('consomme le profil du serveur et l’affiche en lecture seule', async () => {
    await rendreCharge();

    expect(api.profil).toHaveBeenCalledWith('jeton-de-test');
    expect(screen.getByText('camille@example.fr')).toBeTruthy();
    expect(screen.getByText('Camille')).toBeTruthy();
    expect(screen.getByText('Utilisateur')).toBeTruthy();
    expect(screen.getByText(/12 mai 2026/)).toBeTruthy();
  });

  it('annonce la source des cours sans en inventer pour les actions', async () => {
    await rendreCharge();

    expect(screen.getByText(/Coinbase/)).toBeTruthy();
    expect(screen.getByText(/Frankfurter/)).toBeTruthy();
    expect(screen.getByText(/Fournisseur non branché/)).toBeTruthy();
    expect(screen.getByText(/aucun conseil en investissement/)).toBeTruthy();
  });
});

describe('changement de mot de passe', () => {
  async function remplir(utilisateur, { ancien, nouveau, confirmation }) {
    await utilisateur.type(screen.getByLabelText(/^Mot de passe actuel/), ancien);
    await utilisateur.type(screen.getByLabelText(/^Nouveau mot de passe/), nouveau);
    await utilisateur.type(screen.getByLabelText(/^Confirmer le nouveau/), confirmation);
    await utilisateur.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));
  }

  it('transmet les deux mots de passe et confirme que la session reste ouverte', async () => {
    const utilisateur = userEvent.setup();
    await rendreCharge();

    await remplir(utilisateur, {
      ancien: 'ancien-solide',
      nouveau: 'nouveau-solide',
      confirmation: 'nouveau-solide',
    });

    expect(api.changerMotDePasse).toHaveBeenCalledWith('jeton-de-test', {
      ancienMotDePasse: 'ancien-solide',
      nouveauMotDePasse: 'nouveau-solide',
    });
    expect(await screen.findByText(/votre session reste ouverte/i)).toBeTruthy();
  });

  // La spécification demande que le message se pose sur le champ concerné, et non en
  // tête de formulaire : c'est ce champ que l'utilisateur doit corriger.
  it('pose l’erreur du serveur sur le champ de l’ancien mot de passe', async () => {
    const utilisateur = userEvent.setup();
    api.changerMotDePasse.mockRejectedValue(
      new ErreurApi('Ancien mot de passe incorrect.', 400, [
        { champ: 'ancienMotDePasse', message: 'Ancien mot de passe incorrect.' },
      ])
    );
    await rendreCharge();

    await remplir(utilisateur, {
      ancien: 'pas-le-bon',
      nouveau: 'nouveau-solide',
      confirmation: 'nouveau-solide',
    });

    const champ = screen.getByLabelText(/^Mot de passe actuel/);
    await waitFor(() => expect(champ.getAttribute('aria-invalid')).toBe('true'));

    const idErreur = champ.getAttribute('aria-describedby');
    expect(document.getElementById(idErreur).textContent).toContain('Ancien mot de passe incorrect.');
    // Le champ du nouveau mot de passe, lui, n'est pas mis en cause.
    expect(screen.getByLabelText(/^Nouveau mot de passe/).getAttribute('aria-invalid')).toBeNull();
  });

  it('refuse une confirmation qui ne correspond pas, sans appeler le serveur', async () => {
    const utilisateur = userEvent.setup();
    await rendreCharge();

    await remplir(utilisateur, {
      ancien: 'ancien-solide',
      nouveau: 'nouveau-solide',
      confirmation: 'autre-chose-solide',
    });

    expect(api.changerMotDePasse).not.toHaveBeenCalled();
    expect(screen.getByText(/La confirmation ne correspond pas/)).toBeTruthy();
  });
});

describe('déconnexion', () => {
  it('appelle la déconnexion du contexte', async () => {
    const utilisateur = userEvent.setup();
    await rendreCharge();

    await utilisateur.click(screen.getByRole('button', { name: 'Se déconnecter' }));

    expect(deconnecter).toHaveBeenCalled();
  });
});

describe('suppression du compte', () => {
  async function ouvrir(utilisateur) {
    await utilisateur.click(screen.getByRole('button', { name: 'Supprimer mon compte' }));
    return screen.getByRole('dialog');
  }

  it('énonce ce qui sera supprimé et que l’opération est irréversible', async () => {
    const utilisateur = userEvent.setup();
    await rendreCharge();

    const dialogue = await ouvrir(utilisateur);

    expect(dialogue.textContent).toMatch(/mouvements/);
    expect(dialogue.textContent).toMatch(/seuils/);
    expect(dialogue.textContent).toMatch(/irréversible/);
  });

  // Le focus entre sur la saisie, jamais sur le bouton destructeur : une frappe
  // d'Entrée réflexe ne doit rien confirmer.
  it('donne le focus au champ de confirmation, pas au bouton destructeur', async () => {
    const utilisateur = userEvent.setup();
    await rendreCharge();
    await ouvrir(utilisateur);

    expect(document.activeElement).toBe(screen.getByLabelText(/Saisissez votre mot de passe/));
    expect(document.activeElement).not.toBe(
      screen.getByRole('button', { name: 'Supprimer définitivement' })
    );
  });

  it('se ferme par Échap et rend le focus au bouton qui l’a ouvert', async () => {
    const utilisateur = userEvent.setup();
    await rendreCharge();
    const declencheur = screen.getByRole('button', { name: 'Supprimer mon compte' });
    await ouvrir(utilisateur);

    await utilisateur.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(declencheur);
  });

  it('transmet le mot de passe, déconnecte et redirige avec un message', async () => {
    const utilisateur = userEvent.setup();
    await rendreCharge();
    await ouvrir(utilisateur);

    await utilisateur.type(screen.getByLabelText(/Saisissez votre mot de passe/), 'motdepasse-ok');
    await utilisateur.click(screen.getByRole('button', { name: 'Supprimer définitivement' }));

    await waitFor(() => expect(adresse).toBe('/connexion'));
    expect(api.supprimerCompte).toHaveBeenCalledWith('jeton-de-test', {
      motDePasse: 'motdepasse-ok',
    });
    expect(deconnecter).toHaveBeenCalled();
    expect(etatDeNavigation.message).toMatch(/supprimés/);
  });

  it('affiche l’erreur du serveur sur le champ et ne redirige pas', async () => {
    const utilisateur = userEvent.setup();
    api.supprimerCompte.mockRejectedValue(
      new ErreurApi('Mot de passe incorrect.', 400, [
        { champ: 'motDePasse', message: 'Mot de passe incorrect.' },
      ])
    );
    await rendreCharge();
    await ouvrir(utilisateur);

    await utilisateur.type(screen.getByLabelText(/Saisissez votre mot de passe/), 'faux');
    await utilisateur.click(screen.getByRole('button', { name: 'Supprimer définitivement' }));

    expect(await screen.findByText('Mot de passe incorrect.')).toBeTruthy();
    expect(adresse).toBe('/compte');
    expect(deconnecter).not.toHaveBeenCalled();
  });
});

describe('préférences d’affichage', () => {
  it('mémorise la devise choisie sur la clé partagée', async () => {
    const utilisateur = userEvent.setup();
    await rendreCharge();

    await utilisateur.click(screen.getByLabelText('Afficher les montants en dollars'));

    expect(window.sessionStorage.getItem(CLE_DEVISE)).toBe('USD');
  });

  it('mémorise le masquage sur la clé partagée', async () => {
    const utilisateur = userEvent.setup();
    await rendreCharge();

    await utilisateur.click(screen.getByLabelText('Masquer les montants'));

    expect(window.sessionStorage.getItem(CLE_MASQUAGE)).toBe('oui');
  });

  it('reprend la préférence déjà mémorisée par un autre écran', async () => {
    window.sessionStorage.setItem(CLE_DEVISE, 'USD');
    await rendreCharge();

    expect(
      screen.getByLabelText('Afficher les montants en dollars').getAttribute('aria-checked')
    ).toBe('true');
  });
});

describe('export des mouvements', () => {
  it('télécharge le fichier par un appel authentifié', async () => {
    const utilisateur = userEvent.setup();
    await rendreCharge();

    await utilisateur.click(screen.getByRole('button', { name: 'Exporter mes mouvements' }));

    await waitFor(() => expect(api.exporterMouvements).toHaveBeenCalledWith('jeton-de-test'));
    expect(URL.createObjectURL).toHaveBeenCalled();
    // L'objet éphémère est libéré : sans cela le contenu resterait en mémoire jusqu'au
    // rechargement de la page.
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('affiche un message quand l’export échoue', async () => {
    const utilisateur = userEvent.setup();
    api.exporterMouvements.mockRejectedValue(new ErreurApi('Le serveur est injoignable.', 0));
    await rendreCharge();

    await utilisateur.click(screen.getByRole('button', { name: 'Exporter mes mouvements' }));

    expect(await screen.findByText('Le serveur est injoignable.')).toBeTruthy();
  });
});

describe('erreurs et chargement', () => {
  it('annonce le chargement avant l’arrivée du profil', async () => {
    let resoudre;
    api.profil.mockReturnValue(new Promise((r) => { resoudre = r; }));
    rendre();

    expect(screen.getByRole('status').textContent).toMatch(/Chargement/);

    resoudre(PROFIL);
    await screen.findByRole('heading', { name: 'Compte', level: 1 });
  });

  it('propose de se reconnecter quand la session a expiré', async () => {
    api.profil.mockRejectedValue(new ErreurApi('Jeton expiré.', 401));
    rendre();

    expect(await screen.findByRole('button', { name: 'Se reconnecter' })).toBeTruthy();
  });

  it('permet de réessayer après une erreur du serveur', async () => {
    const utilisateur = userEvent.setup();
    api.profil.mockRejectedValueOnce(new ErreurApi('Service indisponible.', 500));
    rendre();

    const reessayer = await screen.findByRole('button', { name: 'Réessayer' });
    api.profil.mockResolvedValue(PROFIL);
    await utilisateur.click(reessayer);

    expect(await screen.findByText('camille@example.fr')).toBeTruthy();
  });
});
