import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MotDePasseOublie from '../MotDePasseOublie';
import Reinitialisation from '../Reinitialisation';
import { api, ErreurApi } from '../../services/api';

// Récupération d'un mot de passe oublié, côté interface (D23, S-28).
//
// L'essentiel de ce qui est vérifié ici tient à ce que l'écran **ne** fait **pas** :
// il ne distingue jamais une adresse connue d'une inconnue, et il ne reformule pas le
// refus du serveur. Les deux protections tomberaient sans bruit si quelqu'un croyait
// bien faire en précisant les messages.

const REPONSE_NEUTRE = {
  message:
    'Si un compte existe pour cette adresse, une demande de réinitialisation vient d’être créée.',
  jeton: null,
};

function rendreDemande() {
  return render(
    <MemoryRouter initialEntries={['/mot-de-passe-oublie']}>
      <Routes>
        <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
        <Route path="/reinitialisation" element={<p>Écran de réinitialisation</p>} />
        <Route path="/connexion" element={<p>Écran de connexion</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function rendreReinitialisation(adresse = '/reinitialisation') {
  return render(
    <MemoryRouter initialEntries={[adresse]}>
      <Routes>
        <Route path="/reinitialisation" element={<Reinitialisation />} />
        <Route path="/connexion" element={<p>Écran de connexion</p>} />
        <Route path="/mot-de-passe-oublie" element={<p>Écran de demande</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.spyOn(api, 'demanderRecuperation').mockResolvedValue(REPONSE_NEUTRE);
  vi.spyOn(api, 'reinitialiserMotDePasse').mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('demande de clé', () => {
  it('affiche le message neutre du serveur sans le reformuler', async () => {
    const utilisateur = userEvent.setup();
    rendreDemande();

    await utilisateur.type(screen.getByLabelText(/^Adresse électronique/), 'camille@exemple.test');
    await utilisateur.click(screen.getByRole('button', { name: 'Demander une clé' }));

    expect(await screen.findByText(REPONSE_NEUTRE.message)).toBeTruthy();
  });

  it('retire le formulaire après l’envoi', async () => {
    // Le laisser en place inviterait à réessayer une autre adresse pour comparer les
    // réponses, ce qui est exactement l'usage que le message neutre veut empêcher.
    const utilisateur = userEvent.setup();
    rendreDemande();

    await utilisateur.type(screen.getByLabelText(/^Adresse électronique/), 'camille@exemple.test');
    await utilisateur.click(screen.getByRole('button', { name: 'Demander une clé' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Demander une clé' })).toBeNull();
    });
  });

  it('n’affiche aucune clé quand le serveur n’en rend pas', async () => {
    const utilisateur = userEvent.setup();
    rendreDemande();

    await utilisateur.type(screen.getByLabelText(/^Adresse électronique/), 'inconnue@exemple.test');
    await utilisateur.click(screen.getByRole('button', { name: 'Demander une clé' }));

    await screen.findByText(REPONSE_NEUTRE.message);
    expect(screen.queryByText(/Mode démonstration/)).toBeNull();
  });

  it('affiche la clé et la signale comme une commodité de démonstration', async () => {
    const jeton = 'a'.repeat(64);
    api.demanderRecuperation.mockResolvedValue({ ...REPONSE_NEUTRE, jeton });
    const utilisateur = userEvent.setup();
    rendreDemande();

    await utilisateur.type(screen.getByLabelText(/^Adresse électronique/), 'camille@exemple.test');
    await utilisateur.click(screen.getByRole('button', { name: 'Demander une clé' }));

    expect(await screen.findByText(jeton)).toBeTruthy();
    // La mention n'est pas décorative : une clé qui n'apparaît que si l'adresse existe
    // révèle l'existence du compte, et l'écran doit le dire plutôt que le laisser
    // découvrir.
    expect(screen.getByText(/Mode démonstration/)).toBeTruthy();
  });

  it('emporte la clé vers l’écran suivant', async () => {
    const jeton = 'b'.repeat(64);
    api.demanderRecuperation.mockResolvedValue({ ...REPONSE_NEUTRE, jeton });
    const utilisateur = userEvent.setup();
    rendreDemande();

    await utilisateur.type(screen.getByLabelText(/^Adresse électronique/), 'camille@exemple.test');
    await utilisateur.click(screen.getByRole('button', { name: 'Demander une clé' }));

    const lien = await screen.findByRole('link', { name: 'Choisir un nouveau mot de passe' });
    expect(lien.getAttribute('href')).toContain(jeton);
  });
});

describe('choix du nouveau mot de passe', () => {
  const JETON = 'c'.repeat(64);

  it('préremplit la clé lue dans l’adresse', () => {
    rendreReinitialisation(`/reinitialisation?jeton=${JETON}`);

    expect(screen.getByLabelText(/Clé de réinitialisation/).value).toBe(JETON);
  });

  it('accepte une clé recopiée à la main', async () => {
    const utilisateur = userEvent.setup();
    rendreReinitialisation();

    await utilisateur.type(screen.getByLabelText(/Clé de réinitialisation/), JETON);
    await utilisateur.type(screen.getByLabelText(/^Nouveau mot de passe/), 'mot-de-passe-neuf');
    await utilisateur.type(screen.getByLabelText(/Confirmer le mot de passe/), 'mot-de-passe-neuf');
    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));

    await waitFor(() => {
      expect(api.reinitialiserMotDePasse).toHaveBeenCalledWith({
        jeton: JETON,
        nouveauMotDePasse: 'mot-de-passe-neuf',
      });
    });
  });

  it('refuse deux saisies discordantes sans appeler le serveur', async () => {
    const utilisateur = userEvent.setup();
    rendreReinitialisation(`/reinitialisation?jeton=${JETON}`);

    await utilisateur.type(screen.getByLabelText(/^Nouveau mot de passe/), 'mot-de-passe-neuf');
    await utilisateur.type(screen.getByLabelText(/Confirmer le mot de passe/), 'autre-chose-long');
    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));

    // Le message se pose sous le champ concerné, et une seule fois.
    expect(await screen.findAllByText(/ne correspondent pas/)).toHaveLength(1);
    expect(api.reinitialiserMotDePasse).not.toHaveBeenCalled();
  });

  it('refuse un mot de passe trop court sans appeler le serveur', async () => {
    const utilisateur = userEvent.setup();
    rendreReinitialisation(`/reinitialisation?jeton=${JETON}`);

    await utilisateur.type(screen.getByLabelText(/^Nouveau mot de passe/), 'court');
    await utilisateur.type(screen.getByLabelText(/Confirmer le mot de passe/), 'court');
    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));

    expect(await screen.findAllByText(/au moins 10 caractères/i)).toHaveLength(1);
    expect(api.reinitialiserMotDePasse).not.toHaveBeenCalled();
  });

  it('renvoie vers la connexion sans connecter', async () => {
    // L'opération ne connecte pas : celui qui vient de poser un mot de passe doit s'en
    // servir, ce qui prouve qu'il l'a bien enregistré.
    const utilisateur = userEvent.setup();
    rendreReinitialisation(`/reinitialisation?jeton=${JETON}`);

    await utilisateur.type(screen.getByLabelText(/^Nouveau mot de passe/), 'mot-de-passe-neuf');
    await utilisateur.type(screen.getByLabelText(/Confirmer le mot de passe/), 'mot-de-passe-neuf');
    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));

    expect(await screen.findByText('Écran de connexion')).toBeTruthy();
  });

  it('reprend le refus du serveur tel quel', async () => {
    const motif = 'Cette demande de réinitialisation est inconnue, déjà utilisée ou expirée.';
    api.reinitialiserMotDePasse.mockRejectedValue(new ErreurApi(motif, 400));
    const utilisateur = userEvent.setup();
    rendreReinitialisation(`/reinitialisation?jeton=${JETON}`);

    await utilisateur.type(screen.getByLabelText(/^Nouveau mot de passe/), 'mot-de-passe-neuf');
    await utilisateur.type(screen.getByLabelText(/Confirmer le mot de passe/), 'mot-de-passe-neuf');
    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));

    // Le serveur rend un refus unique pour les quatre causes possibles. Le préciser ici
    // apprendrait à un tiers laquelle s'applique.
    expect(await screen.findByText(motif)).toBeTruthy();
  });
});
