import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RouteProtegee from '../RouteProtegee';
import * as contexte from '../../contexte/contexteAuthentification';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function rendreAvecSession(estConnecte) {
  vi.spyOn(contexte, 'useAuthentification').mockReturnValue({
    estConnecte,
    jeton: estConnecte ? 'jeton' : null,
    utilisateur: estConnecte ? { pseudo: 'Camille' } : null,
  });

  return render(
    <MemoryRouter initialEntries={['/patrimoine']}>
      <Routes>
        <Route path="/connexion" element={<p>Écran de connexion</p>} />
        <Route
          path="/patrimoine"
          element={
            <RouteProtegee>
              <p>Contenu protégé</p>
            </RouteProtegee>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('garde de routes', () => {
  it('redirige vers la connexion en l\'absence de jeton', () => {
    rendreAvecSession(false);

    expect(screen.getByText('Écran de connexion')).toBeInTheDocument();
    expect(screen.queryByText('Contenu protégé')).not.toBeInTheDocument();
  });

  it('rend le contenu protégé lorsque la session existe', () => {
    rendreAvecSession(true);

    expect(screen.getByText('Contenu protégé')).toBeInTheDocument();
  });
});
