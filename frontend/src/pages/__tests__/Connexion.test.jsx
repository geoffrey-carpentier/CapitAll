import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Connexion from '../Connexion';
import * as contexte from '../../contexte/Authentification';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('écran de connexion', () => {
  it("affiche le message du serveur sans le reformuler", async () => {
    const messageServeur = 'Email ou mot de passe incorrect.';
    const connecter = vi.fn().mockRejectedValue(new Error(messageServeur));

    vi.spyOn(contexte, 'useAuthentification').mockReturnValue({
      estConnecte: false,
      connecter,
    });

    render(
      <MemoryRouter>
        <Connexion />
      </MemoryRouter>
    );

    // La soumission passe par le formulaire : c'est le chemin réel de l'utilisateur.
    screen.getByRole('button', { name: /se connecter/i }).click();

    await waitFor(() => {
      // Le message doit apparaître à l'identique, sans mention de l'adresse ou du
      // mot de passe : c'est ce qui empêche de savoir si un compte existe.
      expect(screen.getByRole('alert')).toHaveTextContent(messageServeur);
    });
  });

  it('associe un libellé à chaque champ de saisie', () => {
    vi.spyOn(contexte, 'useAuthentification').mockReturnValue({
      estConnecte: false,
      connecter: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Connexion />
      </MemoryRouter>
    );

    // getByLabelText échoue si le label n'est pas relié au champ : le test vaut
    // vérification d'accessibilité.
    expect(screen.getByLabelText(/adresse électronique/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument();
  });
});
