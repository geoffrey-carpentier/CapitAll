import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Inscription from '../Inscription';
import * as contexte from '../../contexte/contexteAuthentification';

// L'indicateur de robustesse est la seule chose de cet écran qui réagisse à la frappe :
// tout le reste attend la soumission. Il est donc testé sur ce qui le distingue d'une
// simple décoration — il dit ce qui manque, il l'annonce, et il ne confie rien à la
// seule couleur.

function rendre() {
  vi.spyOn(contexte, 'useAuthentification').mockReturnValue({
    inscrire: vi.fn(),
    estConnecte: false,
  });

  return render(
    <MemoryRouter>
      <Inscription />
    </MemoryRouter>
  );
}

describe('indicateur de robustesse du mot de passe', () => {
  beforeEach(() => rendre());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("ne s'affiche pas tant que le champ est vide", () => {
    expect(screen.queryByText(/Robustesse/)).toBeNull();
  });

  it('se met à jour à la frappe, sans attendre la soumission', async () => {
    const utilisateur = userEvent.setup();

    await utilisateur.type(screen.getByLabelText(/Mot de passe/), 'abc');

    expect(screen.getByText(/Robustesse très faible/)).toBeTruthy();
  });

  it('énonce en toutes lettres ce qui manque encore', async () => {
    const utilisateur = userEvent.setup();

    await utilisateur.type(screen.getByLabelText(/Mot de passe/), 'motdepasselong');

    const resume = screen.getByText(/Robustesse/);
    expect(resume.textContent).toMatch(/une minuscule et une majuscule/);
    expect(resume.textContent).toMatch(/un chiffre/);
    expect(resume.textContent).toMatch(/un caractère spécial/);
  });

  it('reconnaît un mot de passe qui satisfait les quatre critères', async () => {
    const utilisateur = userEvent.setup();

    await utilisateur.type(screen.getByLabelText(/Mot de passe/), 'MotDePasse1!');

    const resume = screen.getByText(/Robustesse/);
    expect(resume.textContent).toMatch(/Robustesse excellente/);
    expect(resume.textContent).not.toMatch(/Il manque/);
  });

  // L'information ne doit jamais reposer sur la seule teinte des segments : la phrase
  // la porte entièrement, et c'est elle qui est annoncée.
  it('annonce le résultat dans une région vivante et masque la jauge décorative', async () => {
    const utilisateur = userEvent.setup();

    await utilisateur.type(screen.getByLabelText(/Mot de passe/), 'abc');

    expect(screen.getByText(/Robustesse/).getAttribute('aria-live')).toBe('polite');
    expect(document.querySelector('.robustesse__jauge').getAttribute('aria-hidden')).toBe('true');
  });
});
